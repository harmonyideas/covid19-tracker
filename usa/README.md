# USA COVID-19 county map

An interactive Leaflet map of confirmed COVID-19 cases and deaths for every US county
(3,217 features in `usacounties.json`). Counties are colored by cumulative confirmed cases.
Hover a county to see its totals, click a county in the table or pick it from the map to zoom to it.

## Files

- `index.html` and `map-usa.js`: the page and the map/table code.
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

## Setting the Mapbox token

The base map tiles come from Mapbox. In `map-usa.js`, replace the placeholder:

```js
const MAPBOX_TOKEN = 'YOUR_MAPBOX_TOKEN';
```

with your own public Mapbox token. Do not commit a real token to the repository.
