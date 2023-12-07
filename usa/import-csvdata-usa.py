import urllib.request
import pandas as pd
import json
import sys

def download_covid19_data(f_date):
    """Downloads the COVID-19 data for the given date.

    Args:
      file_date: The date of the COVID-19 data to download.

    Returns:
      A Pandas DataFrame containing the COVID-19 data.
    """

    url = f"https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports/{f_date}"
    try:
        response = urllib.request.urlopen(url)
    except urllib.error.URLError as err:
        print(err)
        sys.exit(1)

    covid19_data = pd.read_csv(response, iterator=True, chunksize=1000)
    covid19_df = pd.concat([chunk for chunk in covid19_data])
    return covid19_df


def update_usacounties_json(data_df, file_local, file_www):
    """Updates the local usacounties.json file with the given COVID-19 data.

    Args:
      covid19_df: A Pandas DataFrame containing the COVID-19 data.
      file_local: The path to the local usacounties.json file.
      file_www: The path to the web usacounties.json file.
    """

    with open(file_local, "r") as f_local:
        data = json.load(f_local)

    for updaterow in data_df.itertuples():
        for row in data["features"]:
            if (int(row["properties"]["GEOID"])) == updaterow.FIPS:
                row["properties"]["COVID19_CASES"] = updaterow.Confirmed
                row["properties"]["COVID19_DEATHS"] = updaterow.Deaths
    f_local.close()

    with open(file_www, "w+") as f_www:
        json.dump(data, f_www, separators=(",", ":"))
        compress_to_string(f_www)
    f_www.close()


if __name__ == "__main__":
    FILE_DATE = "03-09-2023.csv"
    MY_DF = download_covid19_data(FILE_DATE)
    update_usacounties_json(
        MY_DF,
        "/usr/local/bin/www-scripts/usacounties.json",
        "/var/www/html/map/usacounties.json",
    )
