
from elexon import compare_wind_generation

try:
    result = compare_wind_generation(
        target_date="2026-01-01",
        forecast_publish_time="2025-12-31T22:30:00Z",
    )

    print("Target date:", result["targetDate"])
    print("Forecast published:", result["forecastPublishTime"])
    print("Matched hours:", result["matchedHours"])
    print("MAE:", result["mae"])
    print("Mean Bias Error:", result["meanBiasError"])

    print("\nFirst 3 comparison records:")
    for record in result["records"][:3]:
        print(record)

except Exception as error:
    print("Test failed:", repr(error))
