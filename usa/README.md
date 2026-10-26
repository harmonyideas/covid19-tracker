# USA COVID-19 county map

An interactive Leaflet map of confirmed COVID-19 cases and deaths for every US county
(3,217 features in `usacounties.json`), colored by cumulative cases or deaths. Pick a state to
narrow the map and the ranked list, search for a county, or click one on the map to see its
totals and rank. Counties with zero cases reported under a larger health district and show as
not reported. Base map tiles come from CARTO, so no API key is needed.

## Files

- `index.html` and `map-usa.js`: the page and the map and list code. Styles are in
  `../assets/tracker.css`.
- `usacounties.json`: county boundaries (GeoJSON) with `COVID19_CASES` and `COVID19_DEATHS`.
- `import-csvdata-usa.py`: refreshes the case and death counts in `usacounties.json`.

## Data source

Counts come from the Johns Hopkins CSSE daily reports:
https://github.com/CSSEGISandData/COVID-19 (`csse_covid_19_data/csse_covid_19_daily_reports`).

Run the import script with the name of one daily report file, for example:

```
python3 import-csvdata-usa.py 03-09-2023.csv
```

The file name is the report date in `MM-DD-YYYY.csv` form. The script needs `pandas`.
It matches counties by FIPS code, then writes the result to the paths hard-coded in
`update_usacounties_json` (`/usr/local/bin/www-scripts/usacounties.json` as input and
`/var/www/html/map/usacounties.json` as output). Change those paths if you run it elsewhere.
