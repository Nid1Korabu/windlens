
import httpx
import pandas as pd
from datetime import datetime, timedelta, timezone

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"


def validate_target_date(target_date: str) -> datetime:
    """Validate the requested delivery date."""

    try:
        return datetime.strptime(target_date, "%Y-%m-%d")
    except ValueError as error:
        raise ValueError(
            "Invalid date. Use YYYY-MM-DD, for example 2026-01-28."
        ) from error


def get_forecast_cutoff(target_date: str) -> datetime:
    """
    Return the assumed day-ahead forecast cutoff in UTC.

    This uses 09:50 UTC on the previous day as an assumption
    for the purchasing decision cutoff.
    """

    delivery_date = validate_target_date(target_date).replace(
        tzinfo=timezone.utc
    )

    previous_day = delivery_date - timedelta(days=1)

    return previous_day.replace(
        hour=9,
        minute=50,
        second=0,
        microsecond=0,
    )


def fetch_latest_forecast_publish_time(target_date: str) -> str:
    """Find the latest forecast publication before the assumed cutoff."""

    cutoff = get_forecast_cutoff(target_date)

    response = httpx.get(
        f"{BASE_URL}/forecast/generation/wind/evolution",
        params={
            "startTime": f"{target_date}T00:00:00Z",
        },
        timeout=60.0,
    )
    response.raise_for_status()

    result = response.json()

    if isinstance(result, dict):
        records = result.get("data", [])
    else:
        records = result

    eligible_times = []

    for row in records:
        publish_time_value = row.get("publishTime")
        start_time_value = row.get("startTime", "")

        if not publish_time_value:
            continue

        if not start_time_value.startswith(target_date):
            continue

        publish_time = pd.to_datetime(
            publish_time_value,
            utc=True,
        )

        if publish_time <= cutoff:
            eligible_times.append(publish_time)

    if not eligible_times:
        raise ValueError(
            "No forecast publication was found before the "
            "assumed cutoff for the selected date."
        )

    latest_time = max(eligible_times)

    return latest_time.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_wind_forecasts(
    publish_time: str,
    target_date: str,
):
    """Fetch the selected historical forecast for one delivery date."""

    response = httpx.get(
        f"{BASE_URL}/forecast/generation/wind/history",
        params={
            "publishTime": publish_time,
        },
        timeout=60.0,
    )
    response.raise_for_status()

    result = response.json()

    if isinstance(result, dict):
        records = result.get("data", [])
    else:
        records = result

    return [
        row
        for row in records
        if row.get("startTime", "").startswith(target_date)
    ]


def fetch_wind_actuals(target_date: str):
    """
    Fetch actual wind generation using settlement-date filters.

    Filter by delivery date rather than assuming that publication
    timestamps identify the delivery intervals.
    """

    validate_target_date(target_date)

    response = httpx.get(
        f"{BASE_URL}/datasets/FUELHH/stream",
        params={
            "fuelType": "WIND",
            "settlementDateFrom": target_date,
            "settlementDateTo": target_date,
        },
        timeout=60.0,
    )
    response.raise_for_status()

    result = response.json()

    if isinstance(result, dict):
        records = result.get("data", [])
    else:
        records = result

    actual_records = [
        row
        for row in records
        if row.get("fuelType") == "WIND"
        and row.get("startTime", "").startswith(target_date)
    ]

    if not actual_records:
        return []

    actuals = pd.DataFrame(actual_records)

    actuals["startTime"] = pd.to_datetime(
        actuals["startTime"],
        utc=True,
        errors="coerce",
    )

    actuals["generation"] = pd.to_numeric(
        actuals["generation"],
        errors="coerce",
    )

    actuals = actuals.dropna(
        subset=["startTime", "generation"]
    )

    if actuals.empty:
        return []

    # If an interval appears more than once, retain its latest
    # published record when publication timestamps are available.
    if "publishTime" in actuals.columns:
        actuals["publishTime"] = pd.to_datetime(
            actuals["publishTime"],
            utc=True,
            errors="coerce",
        )

        actuals = actuals.sort_values(
            "publishTime",
            na_position="first",
        )

    actuals = actuals.drop_duplicates(
        subset=["startTime"],
        keep="last",
    )

    return actuals.to_dict(orient="records")


def compare_wind_generation(
    target_date: str,
    forecast_publish_time: str | None = None,
):
    """
    Compare one forecast version with hourly actual wind generation.

    Actuals are hourly averages of two half-hourly readings.
    Hours without exactly two distinct readings are excluded.
    """

    validate_target_date(target_date)

    if forecast_publish_time is None:
        forecast_publish_time = (
            fetch_latest_forecast_publish_time(target_date)
        )

    forecast_records = fetch_wind_forecasts(
        forecast_publish_time,
        target_date,
    )

    actual_records = fetch_wind_actuals(target_date)

    if not forecast_records:
        raise ValueError(
            "No forecast records found for the selected publication."
        )

    if not actual_records:
        raise ValueError(
            "No actual wind generation records found for this date."
        )

    forecasts = pd.DataFrame(forecast_records)
    actuals = pd.DataFrame(actual_records)

    forecasts["startTime"] = pd.to_datetime(
        forecasts["startTime"],
        utc=True,
        errors="coerce",
    )

    forecasts["generation"] = pd.to_numeric(
        forecasts["generation"],
        errors="coerce",
    )

    forecasts = forecasts.dropna(
        subset=["startTime", "generation"]
    )

    forecasts["targetHour"] = forecasts["startTime"].dt.floor("h")

    forecasts = forecasts.rename(
        columns={"generation": "forecastGeneration"}
    )

    # Actual records were already validated and deduplicated.
    actuals = pd.DataFrame(actual_records)

    actuals["startTime"] = pd.to_datetime(
        actuals["startTime"],
        utc=True,
        errors="coerce",
    )

    actuals["generation"] = pd.to_numeric(
        actuals["generation"],
        errors="coerce",
    )

    actuals = actuals.dropna(
        subset=["startTime", "generation"]
    )

    actuals["targetHour"] = actuals["startTime"].dt.floor("h")

    # Count the half-hourly observations in each hour.
    actual_hourly = (
        actuals.groupby("targetHour")
        .agg(
            actualGeneration=("generation", "mean"),
            readingCount=("generation", "count"),
        )
        .reset_index()
    )

    # Compare only hours with both half-hourly readings.
    actual_hourly = actual_hourly[
        actual_hourly["readingCount"] == 2
    ]

    comparison = forecasts[
        ["targetHour", "forecastGeneration"]
    ].merge(
        actual_hourly[
            ["targetHour", "actualGeneration"]
        ],
        on="targetHour",
        how="inner",
    ).sort_values("targetHour")

    if comparison.empty:
        raise ValueError(
            "No matching hours with two half-hourly actual "
            "readings were found."
        )

    errors = (
        comparison["forecastGeneration"]
        - comparison["actualGeneration"]
    )

    comparison["error"] = errors
    comparison["absoluteError"] = errors.abs()

    return {
        "targetDate": target_date,
        "forecastPublishTime": forecast_publish_time,
        "assumedCutoff": get_forecast_cutoff(
            target_date
        ).isoformat(),
        "matchedHours": len(comparison),
        "mae": round(errors.abs().mean(), 2),
        "meanBiasError": round(errors.mean(), 2),
        "records": [
            {
                "targetHour": row["targetHour"].isoformat(),
                "forecastGeneration": round(
                    row["forecastGeneration"], 2
                ),
                "actualGeneration": round(
                    row["actualGeneration"], 2
                ),
                "error": round(row["error"], 2),
                "absoluteError": round(
                    row["absoluteError"], 2
                ),
            }
            for _, row in comparison.iterrows()
        ],
    }
