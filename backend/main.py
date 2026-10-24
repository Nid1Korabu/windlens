
from datetime import date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx

from elexon import compare_wind_generation


app = FastAPI(
    title="WindLens API",
    description="Wind generation forecast and accuracy dashboard",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to WindLens API!",
        "status": "running",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "WindLens backend",
    }


@app.get("/api/wind/comparison")
def wind_comparison(
    target_date: str,
    forecast_publish_time: str | None = None,
):
    try:
        return compare_wind_generation(
            target_date=target_date,
            forecast_publish_time=forecast_publish_time,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Unable to fetch data from Elexon.",
        )


def evaluate_one_day(target_date):
    """
    Evaluate wind forecast accuracy for one date.

    Returns the date, its result, and any error message.
    """

    try:
        result = compare_wind_generation(
            target_date=target_date
        )

        return target_date, result, None

    except ValueError as error:
        return target_date, None, str(error)

    except httpx.HTTPError:
        return (
            target_date,
            None,
            "Unable to fetch data from Elexon.",
        )

    except Exception as error:
        print(
            f"Error evaluating {target_date}: {error}"
        )

        return (
            target_date,
            None,
            "Unexpected error while processing this date.",
        )


@app.get("/api/wind/monthly")
def monthly_wind_comparison():
    """
    Evaluate wind forecast accuracy for January 2026.

    The endpoint evaluates dates concurrently, limits the number
    of simultaneous workers, and reports progress in the terminal.
    """

    start_day = date(2026, 1, 1)
    end_day = date(2026, 2, 1)

    dates = []
    current_day = start_day

    while current_day < end_day:
        dates.append(current_day.isoformat())
        current_day += timedelta(days=1)

    daily_results = []
    missing_days = []

    total_absolute_error = 0.0
    total_error = 0.0
    total_matched_hours = 0

    completed_days = 0

    # Process only three dates concurrently to avoid sending
    # too many requests to the Elexon API at the same time.
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(
                evaluate_one_day,
                target_date,
            ): target_date
            for target_date in dates
        }

        for future in as_completed(futures):
            target_date, result, error = future.result()

            completed_days += 1

            if error is not None:
                missing_days.append({
                    "targetDate": target_date,
                    "reason": error,
                })

            else:
                records = result["records"]

                if not records:
                    missing_days.append({
                        "targetDate": target_date,
                        "reason": (
                            "No matched hourly records."
                        ),
                    })

                else:
                    total_absolute_error += sum(
                        record["absoluteError"]
                        for record in records
                    )

                    total_error += sum(
                        record["error"]
                        for record in records
                    )

                    total_matched_hours += len(records)

                    daily_results.append({
                        "targetDate": target_date,
                        "forecastPublishTime": (
                            result["forecastPublishTime"]
                        ),
                        "matchedHours": len(records),
                        "mae": result["mae"],
                        "meanBiasError": (
                            result["meanBiasError"]
                        ),
                    })

            print(
                "January evaluation progress: "
                f"{completed_days}/{len(dates)} days"
            )

    # Sort both lists into calendar order.
    daily_results.sort(
        key=lambda item: item["targetDate"]
    )

    missing_days.sort(
        key=lambda item: item["targetDate"]
    )

    if total_matched_hours == 0:
        raise HTTPException(
            status_code=502,
            detail=(
                "No matched data was available "
                "for January 2026."
            ),
        )

    # Calculate overall metrics using all matched hourly records.
    overall_mae = (
        total_absolute_error / total_matched_hours
    )

    overall_bias = (
        total_error / total_matched_hours
    )

    return {
        "period": "2026-01",
        "daysRequested": len(dates),
        "daysEvaluated": len(daily_results),
        "daysMissing": len(missing_days),
        "matchedHours": total_matched_hours,
        "mae": round(overall_mae, 2),
        "meanBiasError": round(overall_bias, 2),
        "dailyResults": daily_results,
        "missingDays": missing_days,
    }
