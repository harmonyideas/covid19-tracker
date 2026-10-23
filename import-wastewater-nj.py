#!/usr/bin/env python3
"""Update njcounties.json with CDC wastewater viral activity levels for COVID-19.

Source: CDC National Wastewater Surveillance System (NWSS),
"CDC Wastewater Viral Activity Level for SARS-CoV-2, Influenza A and RSV"
https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re
CDC updates it weekly on Fridays.

CDC reports one level per treatment plant (site), not per county. Each site lists
the counties it serves, so a county's level is the population-weighted average of
the CDC categories of the sites serving it. A site that serves several counties
splits its population evenly between them.

An app token is optional. Without one, Socrata applies a shared rate limit, which is
plenty for one request a week. To use one, create it for free at
https://data.cdc.gov/profile/edit/developer_settings and set SOCRATA_APP_TOKEN.

Usage:
  import-wastewater-nj.py [--geojson IN] [--out OUT] [--input rows.json]

Only the Python standard library is needed.
"""

import argparse
import json
import os
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, timedelta

API_URL = "https://data.cdc.gov/resource/atcp-73re.json"

# CDC's ordered categories. Anything else (e.g. "No Data") is ignored.
LEVELS = ["Very Low", "Low", "Moderate", "High", "Very High"]
NO_DATA = "No data"

# A site's most recent reading is used only if it is at most this old
# relative to the week being reported, so one-off or retired sites drop out.
MAX_SITE_AGE_DAYS = 14

# How far back to request rows: enough for this week, last week and stale checks.
LOOKBACK_DAYS = 42

DEFAULT_GEOJSON = "/usr/local/bin/www-scripts/njcounties.json"
DEFAULT_OUT = "/var/www/html/harmonyideas.com/map/njcounties.json"


def fetch_rows(since):
    """Fetch NJ SARS-CoV-2 site rows with week_end on or after `since`."""
    params = {
        "$select": "site,counties_served,population_served,site_wval,"
                   "site_wval_category,week_end",
        "$where": ("pathogen_target='SARS-CoV-2' "
                   "AND state_territory in('New Jersey','NJ') "
                   f"AND week_end >= '{since.isoformat()}'"),
        "$order": "week_end DESC",
        "$limit": "5000",
    }
    url = API_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    token = os.environ.get("SOCRATA_APP_TOKEN")
    if token:
        request.add_header("X-App-Token", token)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    except (urllib.error.URLError, ValueError) as err:
        sys.exit(f"Could not download wastewater data: {err}")


def parse_week(value):
    """Socrata returns '2026-10-10T00:00:00.000'; accept a bare date too."""
    return date.fromisoformat(str(value)[:10])


def clean_rows(raw_rows):
    """Keep rows with a usable category, week and county list."""
    rows = []
    for raw in raw_rows:
        category = (raw.get("site_wval_category") or "").strip()
        counties = [c.strip() for c in (raw.get("counties_served") or "").split(",")
                    if c.strip()]
        if category not in LEVELS or not counties or not raw.get("week_end"):
            continue
        try:
            population = float(raw.get("population_served") or 0)
        except ValueError:
            population = 0.0
        try:
            wval = float(raw["site_wval"]) if raw.get("site_wval") not in (None, "") else None
        except ValueError:
            wval = None
        rows.append({
            "site": raw.get("site"),
            "counties": counties,
            "population": population,
            "wval": wval,
            "level": LEVELS.index(category),
            "week": parse_week(raw["week_end"]),
        })
    return rows


def county_levels(rows, as_of):
    """Return {county name: summary} using each site's latest reading <= as_of."""
    latest_by_site = {}
    for row in rows:
        if row["week"] > as_of or (as_of - row["week"]).days > MAX_SITE_AGE_DAYS:
            continue
        current = latest_by_site.get(row["site"])
        if current is None or row["week"] > current["week"]:
            latest_by_site[row["site"]] = row

    totals = defaultdict(lambda: {"weight": 0.0, "level_sum": 0.0, "wval_sum": 0.0,
                                  "wval_weight": 0.0, "sites": 0, "population": 0.0})
    for row in latest_by_site.values():
        # Sites with no population figure still count, with a small equal weight.
        weight = (row["population"] or 1.0) / len(row["counties"])
        for county in row["counties"]:
            t = totals[county.lower()]
            t["weight"] += weight
            t["level_sum"] += weight * row["level"]
            t["sites"] += 1
            t["population"] += weight
            if row["wval"] is not None:
                t["wval_sum"] += weight * row["wval"]
                t["wval_weight"] += weight

    result = {}
    for county, t in totals.items():
        result[county] = {
            "level": LEVELS[int(round(t["level_sum"] / t["weight"]))],
            "wval": round(t["wval_sum"] / t["wval_weight"], 2) if t["wval_weight"] else None,
            "sites": t["sites"],
            "population": int(round(t["population"])),
        }
    return result


def trend(now, before):
    if now == NO_DATA or before == NO_DATA:
        return ""
    diff = LEVELS.index(now) - LEVELS.index(before)
    return "Up" if diff > 0 else "Down" if diff < 0 else "Same"


def update_geojson(geojson, rows):
    if not rows:
        sys.exit("No usable NJ wastewater rows returned; leaving the map unchanged.")
    latest_week = max(row["week"] for row in rows)
    this_week = county_levels(rows, latest_week)
    last_week = county_levels(rows, latest_week - timedelta(days=7))

    for feature in geojson["features"]:
        props = feature["properties"]
        if props.get("GEOID") == "0":  # "Unassigned" placeholder, not a county
            continue
        key = props["NAME"].lower()
        now = this_week.get(key)
        before = last_week.get(key)
        level = now["level"] if now else NO_DATA
        props["WW_LEVEL"] = level
        props["WW_WVAL"] = now["wval"] if now else None
        props["WW_SITES"] = now["sites"] if now else 0
        props["WW_TREND"] = trend(level, before["level"] if before else NO_DATA)

    geojson["ww_week_end"] = latest_week.isoformat()
    return geojson


def write_atomic(data, path):
    """Write to a temp file and rename, so the web server never serves half a file."""
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        os.chmod(tmp_path, 0o644)
        os.replace(tmp_path, path)
    except BaseException:
        os.unlink(tmp_path)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--geojson", default=DEFAULT_GEOJSON,
                        help="county GeoJSON to read (default: %(default)s)")
    parser.add_argument("--out", default=DEFAULT_OUT,
                        help="where to write the updated GeoJSON (default: %(default)s)")
    parser.add_argument("--input", help="read API rows from this JSON file instead of "
                                        "downloading (for testing)")
    args = parser.parse_args()

    if args.input:
        with open(args.input) as f:
            raw_rows = json.load(f)
    else:
        raw_rows = fetch_rows(date.today() - timedelta(days=LOOKBACK_DAYS))

    with open(args.geojson) as f:
        geojson = json.load(f)

    updated = update_geojson(geojson, clean_rows(raw_rows))
    write_atomic(updated, args.out)
    counties = [f["properties"] for f in updated["features"]
                if f["properties"].get("GEOID") != "0"]
    with_data = sum(1 for p in counties if p["WW_LEVEL"] != NO_DATA)
    print(f"Week ending {updated['ww_week_end']}: {with_data} of {len(counties)} "
          f"counties have wastewater data. Wrote {args.out}")


if __name__ == "__main__":
    main()
