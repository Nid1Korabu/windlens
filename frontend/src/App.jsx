
import { useState } from "react";
import {
  Activity,
  Wind,
  TrendingUp,
  CalendarDays,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function formatNumber(value) {
  return Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedNumber(value) {
  const number = Number(value);

  if (number > 0) {
    return `+${formatNumber(number)}`;
  }

  return formatNumber(number);
}

function App() {
  const [targetDate, setTargetDate] = useState("2026-01-01");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState(null);
  const [monthlyError, setMonthlyError] = useState("");

  async function loadComparison(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setData(null);

    try {
      const params = new URLSearchParams({
        target_date: targetDate,
      });

      const response = await fetch(
        `${API_BASE_URL}/api/wind/comparison?${params}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to load wind generation data."
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the backend. Check that it is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthlySummary() {
    setMonthlyLoading(true);
    setMonthlyError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/wind/monthly`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail || "Unable to load the monthly evaluation."
        );
      }

      setMonthlyData(result);
    } catch (err) {
      setMonthlyError(
        err.message ||
          "Could not connect to the backend. Check that it is running."
      );
    } finally {
      setMonthlyLoading(false);
    }
  }

  const maximumDailyMae =
    monthlyData?.dailyResults?.length > 0
      ? Math.max(
          1,
          ...monthlyData.dailyResults.map((day) => Number(day.mae))
        )
      : 1;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Wind size={25} />
          </div>

          <div>
            <h2>WindLens</h2>
            <p>ENERGY INTELLIGENCE</p>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <div className="nav-item active">
          <Activity size={19} />
          <span>Wind Analytics</span>
        </div>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>Elexon API integration</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              RENEWABLE ENERGY INTELLIGENCE
            </p>

            <h1>Wind Generation Dashboard</h1>

            <p className="subtitle">
              Compare forecasted wind generation against actual output.
            </p>
          </div>

          <div className="live-badge">
            <span />
            API CONNECTED
          </div>
        </header>

        <section className="intro-card">
          <div className="intro-icon">
            <TrendingUp size={25} />
          </div>

          <div>
            <h3>Make better-informed purchasing decisions</h3>

            <p>
              Evaluate wind forecasts against actual generation to
              understand forecast error and potential uncertainty.
            </p>
          </div>
        </section>

        {/* Monthly January summary */}

        <section className="filter-card">
          <div className="section-heading">
            <div>
              <h2>January 2026 monthly evaluation</h2>

              <p>
                Review overall forecast accuracy across the complete
                January evaluation period.
              </p>
            </div>

            <BarChart3 size={22} />
          </div>

          <button
            type="button"
            onClick={loadMonthlySummary}
            disabled={monthlyLoading}
          >
            {monthlyLoading ? (
              <>
                <RefreshCw size={17} className="spin" />
                Evaluating January...
              </>
            ) : (
              <>
                <BarChart3 size={17} />
                {monthlyData
                  ? "Refresh monthly evaluation"
                  : "Load monthly evaluation"}
              </>
            )}
          </button>

          {monthlyLoading && (
            <p className="hint">
              Fetching real data from Elexon for the January dates.
              This may take a few minutes. Please keep this page open.
            </p>
          )}

          {monthlyError && (
            <div className="error-message">
              <strong>Unable to load monthly evaluation</strong>
              <p>{monthlyError}</p>
            </div>
          )}

          {monthlyData && (
            <>
              <p className="hint">
                Period: {monthlyData.period} · Days evaluated:{" "}
                {monthlyData.daysEvaluated} of{" "}
                {monthlyData.daysRequested} · Missing days:{" "}
                {monthlyData.daysMissing}
              </p>

              <section className="metrics-grid">
                <div className="metric-card">
                  <p>Monthly Mean Absolute Error</p>
                  <h2>{formatNumber(monthlyData.mae)}</h2>
                  <span>MW · Lower is better</span>
                </div>

                <div className="metric-card">
                  <p>Monthly Mean Bias Error</p>
                  <h2>
                    {formatSignedNumber(monthlyData.meanBiasError)}
                  </h2>
                  <span>
                    MW · Positive means overforecast
                  </span>
                </div>

                <div className="metric-card">
                  <p>Matched hourly records</p>
                  <h2>
                    {Number(monthlyData.matchedHours).toLocaleString()}
                  </h2>
                  <span>
                    Matched forecast and actual pairs
                  </span>
                </div>
              </section>

              <div className="data-card">
                <div className="section-heading">
                  <div>
                    <h2>Daily forecast accuracy</h2>
                    <p>
                      Daily Mean Absolute Error for January 2026.
                      Shorter bars indicate lower absolute error.
                    </p>
                  </div>
                </div>

                {monthlyData.dailyResults.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      marginTop: "20px",
                    }}
                  >
                    {monthlyData.dailyResults.map((day) => (
                      <div
                        key={day.targetDate}
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "100px minmax(40px, 1fr) 100px",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span style={{ fontSize: "13px" }}>
                          {day.targetDate}
                        </span>

                        <div
                          style={{
                            height: "18px",
                            background: "var(--chart-track, #e8edf3)",
                            borderRadius: "5px",
                            overflow: "hidden",
                          }}
                          title={`MAE: ${formatNumber(day.mae)} MW`}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(
                                100,
                                (Number(day.mae) / maximumDailyMae) * 100
                              )}%`,
                              background: "var(--chart-bar, #4387d8)",
                              borderRadius: "5px",
                            }}
                          />
                        </div>

                        <span
                          style={{
                            textAlign: "right",
                            fontSize: "13px",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatNumber(day.mae)} MW
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No daily results are available.</p>
                )}
              </div>

              <div className="data-card">
                <div className="section-heading">
                  <div>
                    <h2>Daily evaluation details</h2>
                    <p>
                      Forecast publication time and accuracy metrics
                      for each evaluated day.
                    </p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Forecast publication (UTC)</th>
                        <th>Matched hours</th>
                        <th>MAE (MW)</th>
                        <th>Mean bias (MW)</th>
                      </tr>
                    </thead>

                    <tbody>
                      {monthlyData.dailyResults.map((day) => (
                        <tr key={day.targetDate}>
                          <td>{day.targetDate}</td>

                          <td>{day.forecastPublishTime}</td>

                          <td>{day.matchedHours}</td>

                          <td>{formatNumber(day.mae)}</td>

                          <td
                            className={
                              Number(day.meanBiasError) > 0
                                ? "positive"
                                : Number(day.meanBiasError) < 0
                                  ? "negative"
                                  : ""
                            }
                          >
                            {formatSignedNumber(day.meanBiasError)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {monthlyData.missingDays.length > 0 && (
                <div className="error-message">
                  <strong>
                    {monthlyData.missingDays.length} date(s) could not
                    be evaluated
                  </strong>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Reason</th>
                        </tr>
                      </thead>

                      <tbody>
                        {monthlyData.missingDays.map((day) => (
                          <tr key={day.targetDate}>
                            <td>{day.targetDate}</td>
                            <td>{day.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="hint">
                Methodology: the monthly metrics are calculated across
                all matched hourly records. Actual wind generation is
                currently represented by the average of the two
                half-hourly readings within each hour. Forecast selection
                uses the assumed 09:50 UTC cutoff on the previous day;
                this market-rule assumption must be validated before
                treating the results as definitive.
              </p>
            </>
          )}
        </section>

        {/* Daily analysis filters */}

        <section className="filter-card">
          <div className="section-heading">
            <div>
              <h2>Daily analysis</h2>

              <p>
                Select a delivery date. WindLens selects an eligible
                forecast automatically.
              </p>
            </div>

            <CalendarDays size={22} />
          </div>

          <form onSubmit={loadComparison} className="filter-form">
            <label>
              Target date

              <input
                type="date"
                value={targetDate}
                min="2026-01-01"
                max="2026-01-31"
                onChange={(event) =>
                  setTargetDate(event.target.value)
                }
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={17} className="spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Activity size={17} />
                  Analyse generation
                </>
              )}
            </button>
          </form>

          <p className="hint">
            Forecast selection currently uses an assumed 09:50 UTC
            cutoff on the previous day. This assumption must be
            validated against the applicable market rules.
          </p>
        </section>

        {error && (
          <div className="error-message">
            <strong>Unable to load analysis</strong>
            <p>{error}</p>
          </div>
        )}

        {!data && !error && (
          <section className="empty-state">
            <div className="empty-icon">
              <Wind size={32} />
            </div>

            <h2>Your daily analysis starts here</h2>

            <p>
              Choose a date and click Analyse generation to load real
              data from the Elexon API.
            </p>
          </section>
        )}

        {data && (
          <>
            <section className="data-card">
              <div className="section-heading">
                <div>
                  <h2>Forecast selection</h2>

                  <p>
                    Selected publication:{" "}
                    <strong>{data.forecastPublishTime}</strong>
                  </p>

                  <p>
                    Assumed cutoff:{" "}
                    <strong>{data.assumedCutoff}</strong>
                  </p>
                </div>
              </div>
            </section>

            <section className="metrics-grid">
              <div className="metric-card">
                <p>Mean Absolute Error</p>
                <h2>{formatNumber(data.mae)}</h2>
                <span>MW · Lower is better</span>
              </div>

              <div className="metric-card">
                <p>Mean Bias Error</p>
                <h2>{formatSignedNumber(data.meanBiasError)}</h2>
                <span>MW · Positive means overforecast</span>
              </div>

              <div className="metric-card">
                <p>Matched hours</p>
                <h2>{data.matchedHours}</h2>
                <span>Forecast and actual pairs</span>
              </div>
            </section>

            <section className="data-card">
              <div className="section-heading">
                <div>
                  <h2>Forecast vs actual generation</h2>

                  <p>
                    Target date: {data.targetDate} · All timestamps
                    shown in UTC
                  </p>
                </div>
              </div>

              <div className="chart-legend">
                <span>
                  <i className="legend-forecast" /> Forecast
                </span>

                <span>
                  <i className="legend-actual" /> Actual
                </span>
              </div>

              <div className="chart">
                {data.records.map((record) => {
                  const maxValue = Math.max(
                    1,
                    ...data.records.map((item) =>
                      Math.max(
                        item.forecastGeneration,
                        item.actualGeneration
                      )
                    )
                  );

                  return (
                    <div
                      className="chart-column"
                      key={record.targetHour}
                      title={`${record.targetHour}: Forecast ${record.forecastGeneration} MW, actual ${record.actualGeneration} MW`}
                    >
                      <div className="bar-pair">
                        <div
                          className="bar forecast-bar"
                          style={{
                            height: `${
                              (record.forecastGeneration / maxValue) *
                              100
                            }%`,
                          }}
                        />

                        <div
                          className="bar actual-bar"
                          style={{
                            height: `${
                              (record.actualGeneration / maxValue) *
                              100
                            }%`,
                          }}
                        />
                      </div>

                      <span className="chart-label">
                        {new Date(record.targetHour)
                          .getUTCHours()
                          .toString()
                          .padStart(2, "0")}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="chart-note">
                Each bar represents hourly generation in MW. Hover
                over a bar group to inspect its values.
              </p>
            </section>

            <section className="data-card">
              <div className="section-heading">
                <div>
                  <h2>Hourly breakdown</h2>
                  <p>
                    Detailed forecast errors for each matched hour.
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Hour (UTC)</th>
                      <th>Forecast (MW)</th>
                      <th>Actual (MW)</th>
                      <th>Error (MW)</th>
                      <th>Absolute error (MW)</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.records.map((record) => (
                      <tr key={record.targetHour}>
                        <td>
                          {new Date(record.targetHour)
                            .toISOString()
                            .slice(11, 16)}
                        </td>

                        <td>
                          {formatNumber(record.forecastGeneration)}
                        </td>

                        <td>
                          {formatNumber(record.actualGeneration)}
                        </td>

                        <td
                          className={
                            record.error > 0
                              ? "positive"
                              : record.error < 0
                                ? "negative"
                                : ""
                          }
                        >
                          {formatSignedNumber(record.error)}
                        </td>

                        <td>
                          {formatNumber(record.absoluteError)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <footer>
          WindLens · Data sourced from Elexon BMRS · January 2026 analysis
        </footer>
      </main>
    </div>
  );
}

export default App;
