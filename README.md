# covid19-tracker
COVID-19 county maps for New Jersey and the USA. A static site (HTML, JavaScript and
GeoJSON) built on Leaflet 1.9 and plain JavaScript, plus Python scripts that refresh the
data. The background map uses OpenStreetMap's standard tiles, which need no API key. Both pages
work on phones and follow the system's light or dark setting.

| Map | Page | Data |
|-----|------|------|
| NJ counties | `index.html` + `map-nj.js` | CDC wastewater viral activity levels, weekly |
| USA counties | `usa/index.html` + `usa/map-usa.js` | Johns Hopkins CSSE cases and deaths (see [usa/README.md](usa/README.md)) |

# Tracking COVID-19 for NJ counties
Weekly CDC wastewater levels by county (screenshot: week ending October 17, 2026). The bar
at the top shows the share of New Jersey residents living in counties at each level and
doubles as the map legend. Select a county on the map, in the list or by searching to see its
level, the change from the week before and an 8-week trend. The selected county is kept in
the page address (for example `#county=Mercer`), so a view can be shared.

![NJ county map colored by CDC COVID-19 wastewater level, with the statewide level bar and county list](/screenshots/nj-covid19-tracker.png "NJ COVID-19 wastewater levels")

# Tracking COVID-19 for USA counties
Final cumulative cases and deaths by county, as of March 2023. Switch between cases and
deaths, narrow the map and the ranked list to one state, or search for a county to see its
totals and its rank in its state and the country.

![USA county map colored by total COVID-19 cases](/screenshots/usa-covid19-tracker.png "USA COVID-19 cases by county")

# Running it
There is no build step, and no PHP or database is needed: any web server that serves the
repository folder works. The pages fetch their GeoJSON with `$.getJSON`, so open them over
HTTP rather than as `file://`.

Quick local preview:

    python3 -m http.server 8000
    # NJ map:  http://localhost:8000/
    # USA map: http://localhost:8000/usa/

## Docker (Apache)
To run it in a Docker Apache/PHP container whose web root is a mounted `public/` folder,
clone the repository straight into that folder:

    cd ~/Projects/Docker/covid19-app/public
    rm -f index.php info.php .htaccess            # remove any sample files first
    git clone https://github.com/harmonyideas/covid19-tracker.git .

    # don't serve the .git folder to browsers
    echo 'RedirectMatch 404 /\.git' > .htaccess
    echo '.htaccess' >> .git/info/exclude

Changes are live as soon as the files change; the container does not need restarting.
The NJ map is at `http://<host>:<port>/` and the USA map at `http://<host>:<port>/usa/`.

## Updating from GitHub
Running the NJ import rewrites `njcounties.json`, which is tracked in git, so discard that
local change before pulling, then run the import again:

    git checkout -- njcounties.json && git pull
    python3 import-wastewater-nj.py --geojson njcounties.json --out njcounties.json

# NJ data source
The NJ map shows the CDC's weekly COVID-19 wastewater viral activity level for each county,
from the National Wastewater Surveillance System dataset
[atcp-73re](https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re).
CDC reports a level per treatment plant; `import-wastewater-nj.py` combines the plants serving
each county, weighted by population served. Case and death totals are the final NYT figures
from March 2023, when national case reporting ended.

Update it weekly, after CDC's Friday refresh (needs only the Python standard library).
The script's default paths are for the production server:

    # crontab: Saturdays at 06:00
    0 6 * * 6  /usr/bin/python3 /usr/local/bin/www-scripts/import-wastewater-nj.py

When the site runs from a clone of this repository (for example the Docker setup above),
point both paths at the repository's own file. Reading and writing the same file is safe,
because the script writes to a temporary file and renames it into place:

    # crontab: Saturdays at 06:00
    0 6 * * 6  cd /path/to/covid19-tracker && /usr/bin/python3 import-wastewater-nj.py --geojson njcounties.json --out njcounties.json

A Socrata app token is optional (it raises the rate limit). Create one free at
https://data.cdc.gov/profile/edit/developer_settings and set `SOCRATA_APP_TOKEN` in the cron
environment. Use `--input` to test against saved API rows instead of downloading.

The script also writes each county's last 8 weeks (`WW_HISTORY`, with the week dates in
`ww_weeks`) for the trend charts. Until it has run once, the page shows every county as
no data and says the levels haven't been loaded yet.

# USA map
The USA map needs no setup beyond serving the files. Its import script needs `pandas` and
has hard-coded input and output paths. See [usa/README.md](usa/README.md).

# Files
- `index.html`, `map-nj.js`: the NJ page.
- `usa/index.html`, `usa/map-usa.js`: the USA page.
- `assets/tracker.css`: styles shared by both pages.
- `assets/basemap.js`: base map tiles and small helpers shared by both pages.

# Background map
By default both pages use OpenStreetMap's standard tiles, which need no key but are meant
for light use ([tile usage policy](https://operations.osmfoundation.org/policies/tiles/)).
For a cleaner background with place names drawn above the counties, request a free CARTO key
at https://carto.com/basemaps/apikey/ (non-commercial use, 5 million tiles a month) and set
`CARTO_API_KEY` at the top of `assets/basemap.js`.
