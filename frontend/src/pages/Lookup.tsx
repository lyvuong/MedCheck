import { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { searchMedications } from "../data/medications";
import { searchPlans } from "../data/insurancePlans";
import { checkCoverage } from "../data/coverage";
import type { CoverageCheckResult, InsurancePlan, Medication } from "../data/types";

const TIER_SPECTRUM = [
  {
    tierKey: "TIER_1_PREFERRED_GENERIC",
    tierClass: "tier-1",
    label: "[TIER 1]",
    title: "Preferred Generic",
    costHint: "Low Copay (~$10)",
    icon: "🛡️",
  },
  {
    tierKey: "TIER_2_GENERIC",
    tierClass: "tier-2",
    label: "[TIER 2]",
    title: "Preferred Brand",
    costHint: "Mid Copay (~$35)",
    icon: "🛡️",
  },
  {
    tierKey: "TIER_3_PREFERRED_BRAND",
    tierClass: "tier-3",
    label: "[TIER 3]",
    title: "Non-Preferred Brand",
    costHint: "Higher Copay (~$70)",
    icon: "🛡️",
  },
  {
    tierKey: "TIER_4_NON_PREFERRED_DRUG",
    tierClass: "tier-4",
    label: "[TIER 4/5]",
    title: "Specialty Drugs",
    costHint: "Prior Auth Required",
    icon: "🛡️",
  },
];

const TIER_LABELS: Record<string, string> = {
  TIER_1_PREFERRED_GENERIC: "Tier 1 — Preferred Generic",
  TIER_2_GENERIC: "Tier 2 — Generic / Preferred",
  TIER_3_PREFERRED_BRAND: "Tier 3 — Preferred Brand",
  TIER_4_NON_PREFERRED_DRUG: "Tier 4 — Non-Preferred Drug",
  TIER_5_SPECIALTY: "Tier 5 — Specialty Biologics",
  NOT_COVERED: "Not Covered",
  UNKNOWN: "Unknown Tier",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manually Entered",
  CMS_PUF: "CMS Public Formulary Data",
};

function useDebouncedSearch<T>(
  query: string,
  search: (q: string) => Promise<T[]>,
  minLength = 2
): T[] {
  const [results, setResults] = useState<T[]>([]);
  const requestId = useRef(0);

  useEffect(() => {
    if (query.trim().length < minLength) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    const handle = setTimeout(() => {
      search(query)
        .then((res) => {
          if (id === requestId.current) setResults(res);
        })
        .catch(() => {
          if (id === requestId.current) setResults([]);
        });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return results;
}

export function Lookup() {
  const { user } = useAuth();
  const [medQuery, setMedQuery] = useState("");
  const [planQuery, setPlanQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [result, setResult] = useState<CoverageCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medResults = useDebouncedSearch(medQuery, searchMedications);
  const planResults = useDebouncedSearch(planQuery, searchPlans);

  async function runCheck(med: Medication, plan: InsurancePlan) {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const res = await checkCoverage(plan.id, med.id, user!.email);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (selectedMed && selectedPlan) {
      runCheck(selectedMed, selectedPlan);
    }
  }, [selectedMed, selectedPlan]);

  return (
    <div className="lookup-page">
      {/* Dashboard Top Header */}
      <div className="dashboard-hero">
        <div className="dashboard-header-row">
          <div className="dashboard-title-box">
            <h1>
              <span>💊</span> Medication Coverage Dashboard
            </h1>
            <p>Real-time formulary tier determination, prior authorization checks, and alternative analysis</p>
          </div>
          <div className="dashboard-live-badge">
            <span className="pulse-dot" />
            <span>Formulary Engine Active</span>
          </div>
        </div>
      </div>

      {/* Dual Glassmorphic Search Pods */}
      <div className="search-grid">
        {/* Medication Pod */}
        <div className="search-pod">
          <div className="search-pod-header">
            <span className="search-pod-title">
              <span>💊</span> Medication
            </span>
            {selectedMed && (
              <button
                className="link-button"
                style={{ fontSize: "0.75rem" }}
                onClick={() => {
                  setSelectedMed(null);
                  setResult(null);
                  setMedQuery("");
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="search-input-wrapper">
            <span className="search-icon-badge">🔍</span>
            <input
              id="med-search"
              placeholder="Search by brand name, generic, or NDC…"
              value={selectedMed ? selectedMed.name : medQuery}
              onChange={(e) => {
                setSelectedMed(null);
                setResult(null);
                setMedQuery(e.target.value);
              }}
            />
            {selectedMed && (
              <button
                className="clear-btn"
                onClick={() => {
                  setSelectedMed(null);
                  setResult(null);
                  setMedQuery("");
                }}
              >
                ✕
              </button>
            )}
          </div>
          {!selectedMed && medResults.length > 0 && (
            <ul className="suggestions">
              {medResults.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setSelectedMed(m)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{m.name}</strong>
                      {m.drugClass && <span className="drug-class-chip">{m.drugClass}</span>}
                    </div>
                    {(m.genericName || m.strength) && (
                      <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                        {m.genericName} {m.strength && `· ${m.strength}`}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Insurance Plan Pod */}
        <div className="search-pod">
          <div className="search-pod-header">
            <span className="search-pod-title">
              <span>🛡️</span> Insurance Plan
            </span>
            {selectedPlan && (
              <button
                className="link-button"
                style={{ fontSize: "0.75rem" }}
                onClick={() => {
                  setSelectedPlan(null);
                  setResult(null);
                  setPlanQuery("");
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="search-input-wrapper">
            <span className="search-icon-badge">📋</span>
            <input
              id="plan-search"
              placeholder="Search by payer (e.g. Blue Cross, Aetna, Medicare)…"
              value={selectedPlan ? `${selectedPlan.payerName} — ${selectedPlan.planName}` : planQuery}
              onChange={(e) => {
                setSelectedPlan(null);
                setResult(null);
                setPlanQuery(e.target.value);
              }}
            />
            {selectedPlan && (
              <button
                className="clear-btn"
                onClick={() => {
                  setSelectedPlan(null);
                  setResult(null);
                  setPlanQuery("");
                }}
              >
                ✕
              </button>
            )}
          </div>
          {!selectedPlan && planResults.length > 0 && (
            <ul className="suggestions">
              {planResults.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelectedPlan(p)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{p.payerName}</strong>
                      {p.planType && <span className="drug-class-chip">{p.planType}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                      {p.planName} {p.state && `(${p.state})`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Interactive Formulary Tier Spectrum HUD */}
      <div className="tier-spectrum-section">
        <div className="spectrum-header">
          <span className="spectrum-title">
            <span>📊</span> Formulary Tier Spectrum
          </span>
          {result && (
            <span className="muted" style={{ fontSize: "0.8rem", fontWeight: 700 }}>
              Matched Tier: {TIER_LABELS[result.coverage.tier] ?? result.coverage.tier}
            </span>
          )}
        </div>

        <div className="tier-cards-grid">
          {TIER_SPECTRUM.map((t, idx) => {
            const isMatch =
              result &&
              (result.coverage.tier === t.tierKey ||
                (t.tierKey === "TIER_4_NON_PREFERRED_DRUG" && result.coverage.tier === "TIER_5_SPECIALTY"));

            return (
              <div key={idx} className={`glow-tier-card ${t.tierClass} ${isMatch ? "active-match" : ""}`}>
                {isMatch && <span className="active-match-tag">Active Match</span>}
                <div className="tier-badge-pill">
                  <span>{t.label}</span>
                  <span>{t.icon}</span>
                </div>
                <div className="tier-card-title">{t.title}</div>
                <div className="tier-card-cost">
                  {isMatch && result?.coverage?.estimatedCost ? result.coverage.estimatedCost : t.costHint}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {checking && (
        <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
          <span className="pulse-dot" style={{ display: "inline-block", margin: "0 auto 0.75rem" }} />
          <p className="muted" style={{ margin: 0 }}>
            Querying Firestore coverage repository…
          </p>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {/* Comprehensive Coverage HUD Result */}
      {result && (
        <div className={`result-card-hud ${result.coverage.covered ? "covered" : "not-covered"}`}>
          <div className="hud-header">
            <div className="hud-title-area">
              <h2>{result.medication.name}</h2>
              <div className="hud-meta-row">
                <span className="plan-name-badge">
                  <span>🛡️</span> {result.plan.payerName} — {result.plan.planName}
                </span>
                {result.medication.drugClass && (
                  <span className="drug-class-chip">
                    <span>🧬</span> Class: {result.medication.drugClass}
                  </span>
                )}
              </div>
            </div>

            <div className={`status-badge-lg ${result.coverage.covered ? "covered" : "not-covered"}`}>
              <span>{result.coverage.covered ? "✅" : "❌"}</span>
              <span>{result.coverage.covered ? "Covered" : "Not Covered"}</span>
            </div>
          </div>

          {/* 4-Metric Matrix */}
          <div className="hud-metrics-grid">
            <div className="metric-pod">
              <span className="metric-label">
                <span>🏷️</span> Formulary Tier
              </span>
              <span className="metric-value">{TIER_LABELS[result.coverage.tier] ?? result.coverage.tier}</span>
            </div>

            <div className="metric-pod">
              <span className="metric-label">
                <span>💰</span> Estimated Patient Cost
              </span>
              <span className="metric-value" style={{ color: result.coverage.covered ? "var(--ok)" : "var(--bad)" }}>
                {result.coverage.estimatedCost || (result.coverage.covered ? "Covered (Standard)" : "100% Out of Pocket")}
              </span>
            </div>

            <div className="metric-pod">
              <span className="metric-label">
                <span>📏</span> Quantity Limit
              </span>
              <span className="metric-value">{result.coverage.quantityLimit || "No Limit on File"}</span>
            </div>

            <div className="metric-pod">
              <span className="metric-label">
                <span>🗂️</span> Data Origin
              </span>
              <span className="source-chip">{SOURCE_LABELS[result.coverage.source] ?? result.coverage.source}</span>
            </div>
          </div>

          {/* Requirements & Policy Flags */}
          <div className="flags-row">
            {result.coverage.priorAuthRequired ? (
              <span className="flag-badge warn">⚠️ Prior Authorization Required</span>
            ) : (
              <span className="flag-badge ok">✓ No Prior Auth Required</span>
            )}

            {result.coverage.stepTherapyRequired ? (
              <span className="flag-badge warn">⚠️ Step Therapy Mandated</span>
            ) : (
              <span className="flag-badge ok">✓ No Step Therapy Mandate</span>
            )}
          </div>

          {result.coverage.notes && (
            <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              <strong>Clinical Notes:</strong> {result.coverage.notes}
            </p>
          )}

          {/* Covered Alternatives Deck */}
          {result.alternatives.length > 0 && (
            <div className="alternatives-deck">
              <div className="alternatives-header">
                <h3>
                  <span>🔄</span> Covered Alternatives in Class ({result.medication.drugClass})
                </h3>
              </div>

              <div className="alternatives-grid">
                {result.alternatives.map((alt) => (
                  <div key={alt.id} className="alt-card">
                    <div>
                      <div className="alt-card-header">
                        <span className="alt-name">{alt.name}</span>
                        <span className="drug-class-chip" style={{ fontSize: "0.7rem" }}>
                          <span>🏷️</span> {TIER_LABELS[alt.tier] ?? alt.tier}
                        </span>
                      </div>
                      <div className="alt-cost">{alt.estimatedCost ? `Est. ${alt.estimatedCost}` : "Covered"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
