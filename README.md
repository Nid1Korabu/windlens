# WindLens — Wind Generation Forecast Evaluation

WindLens is a full-stack application that compares UK national wind generation forecasts with actual wind generation using data from the Elexon BMRS API.

It evaluates January 2026 and presents monthly forecast accuracy, daily errors, forecast publication timestamps, and hourly forecast-versus-actual comparisons.

## Features

- Retrieves wind forecast and actual generation data from Elexon.
- Selects a forecast publication using a configurable evaluation cutoff assumption.
- Compares hourly forecasts with hourly actual generation.
- Calculates Mean Absolute Error (MAE) and Mean Bias Error.
- Displays monthly summary metrics, daily accuracy, charts, and hourly breakdowns.
- Uses a React frontend and Python FastAPI backend.
- Supports local development and Docker Compose.

## Technology Stack

**Frontend:** React, Vite, Recharts, Lucide React  
**Backend:** Python, FastAPI, Uvicorn, Pandas, HTTPX  
**Containerization:** Docker, Docker Compose  
**Data source:** Elexon BMRS API

## Project Structure

```text
TASK HAI/
├── backend/
│   ├── main.py
│   ├── elexon.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml
└── README.md
```

Other frontend files, such as `package.json`, the Vite configuration, and any additional source files, are retained in the repository.

## Run with Docker

### Prerequisites

- Docker Desktop installed and running.
- Git, if cloning the repository.

### Start the application

From the project root, run:

```bash
docker compose up --build
```

Open the following URLs:

- Frontend: http://localhost:5173
- Backend health check: http://localhost:8000/api/health

To stop the containers, press `Ctrl+C` in the terminal and then run:

```bash
docker compose down
```

## Data Sources

The application uses Elexon BMRS data:

- Wind actual generation: FUELHH dataset.
- Wind generation forecasts: WINDFOR forecast data and forecast publication history.

The analysis is restricted to UK national wind generation for January 2026.

## Evaluation Methodology

### Forecast selection

For each delivery day, the application currently uses an assumed cutoff of 09:50 UTC on the previous day and selects an eligible forecast publication.

**This cutoff is an implementation assumption and must be validated against the applicable market rules before the results are treated as definitive for purchasing decisions.**

### Actual generation

Actual generation is supplied at half-hourly intervals. The current implementation averages the two half-hourly readings within each hour to obtain an hourly actual-generation value. Only complete hours with two readings are included in the comparison.

This aggregation method is an implementation choice and may be refined if the evaluation requires a different settlement-period convention.

### Metrics

- **Mean Absolute Error (MAE):** Average absolute difference between forecast and actual generation. Lower values indicate smaller errors.
- **Mean Bias Error:** Average signed difference, calculated as forecast minus actual. Positive values indicate overforecasting; negative values indicate underforecasting.
- **Matched hours:** Number of hourly forecast and actual pairs included in the evaluation.

## Sample January 2026 Results

The current implementation reports:

- Days evaluated: 31
- Missing days: 0
- Matched hourly records: 744
- Monthly MAE: 2,122.81 MW
- Monthly mean bias: +1,840.30 MW

These figures are outputs of the current implementation and depend on the forecast-selection and actual-generation aggregation assumptions described above.

## Responsible Use of AI

AI-assisted development tools were used during development. The implementation, testing, and methodology should be reviewed and validated before the results are used for operational purchasing decisions.

## Deployment

- **Live frontend:** https://windlens-iota.vercel.app/
- **Backend API:** https://windlens-api.onrender.com
- **Backend health check:** https://windlens-api.onrender.com/api/health
- **GitHub repository:** https://github.com/Nid1Korabu/windlens

The deployed frontend connects to the FastAPI backend hosted on Render. The backend may take 50 seconds or more to respond to the first request after a period of inactivity because it uses a free instance.

## Limitations and Future Improvements

- Validate the forecast-selection cutoff against the applicable market rules.
- Review the hourly aggregation method against the intended settlement-period methodology.
- Improve error handling for unavailable or incomplete upstream data.
- Add automated tests for API responses, calculations, and forecast selection.
- Further validate the deployed application and evaluation results before using them for operational purchasing decisions.
