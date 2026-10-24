# covid19-tracker
COVID-19 county maps for New Jersey and the USA. A static site (HTML, JavaScript and
GeoJSON) built on Leaflet, jQuery, DataTables and Bootstrap, plus Python scripts that
refresh the data.

| Map | Page | Data |
|-----|------|------|
| NJ counties | `index.html` + `map-nj.js` | CDC wastewater viral activity levels, weekly |
| USA counties | `usa/index.html` + `usa/map-usa.js` | Johns Hopkins CSSE cases and deaths (see [usa/README.md](usa/README.md)) |

# Tracking COVID-19 for NJ counties
Weekly CDC wastewater levels by county (screenshot: week ending October 17, 2026).

![NJ county map colored by CDC COVID-19 wastewater level](/screenshots/nj-covid19-tracker.png "NJ COVID-19 wastewater levels")

# Tracking COVID-19 for USA counties
Final cumulative cases and deaths by county, as of March 2023.

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

# USA map
The USA map needs a Mapbox token for its base map tiles: replace `YOUR_MAPBOX_TOKEN` in
`usa/map-usa.js` with your own public token, and don't commit a real token. Its import script
needs `pandas` and has hard-coded input and output paths. See [usa/README.md](usa/README.md).
