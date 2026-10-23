# covid19-tracker
Covid-19 tracker for NJ and USA

# Tracking Covid-19 for NJ counties
![covid-19-nj](/screenshots/nj-covid19-tracker.png "NJ CoronaVirus Stats")

# Tracking Covid-19 for USA counties
![covid-19-usa](/screenshots/usa-covid19-tracker.png "USA CoronaVirus Stats")


# NJ data source
The NJ map shows the CDC's weekly COVID-19 wastewater viral activity level for each county,
from the National Wastewater Surveillance System dataset
[atcp-73re](https://data.cdc.gov/Public-Health-Surveillance/CDC-Wastewater-Viral-Activity-Level-for-SARS-CoV-2/atcp-73re).
CDC reports a level per treatment plant; `import-wastewater-nj.py` combines the plants serving
each county, weighted by population served. Case and death totals are the final NYT figures
from March 2023, when national case reporting ended.

Update it weekly, after CDC's Friday refresh (needs only the Python standard library):

    # crontab: Saturdays at 06:00
    0 6 * * 6  /usr/bin/python3 /usr/local/bin/www-scripts/import-wastewater-nj.py

A Socrata app token is optional (it raises the rate limit). Create one free at
https://data.cdc.gov/profile/edit/developer_settings and set `SOCRATA_APP_TOKEN` in the cron
environment. Use `--geojson`, `--out` and `--input` to change paths or test against saved rows.
