import { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { searchMedications } from "../data/medications";
import { searchPlans } from "../data/insurancePlans";
import { checkCoverage } from "../data/coverage";
import type { CoverageCheckResult, InsurancePlan, Medication } from "../data/types";

const TIER_LABELS: Record<string, string> = {
  TIER_1_PREFERRED_GENERIC: "Tier 1 — Preferred generic",
  TIER_2_GENERIC: "Tier 2 — Generic",
  TIER_3_PREFERRED_BRAND: "Tier 3 — Preferred brand",
  TIER_4_NON_PREFERRED_DRUG: "Tier 4 — Non-preferred drug",
  TIER_5_SPECIALTY: "Tier 5 — Specialty",
  NOT_COVERED: "Not covered",
  UNKNOWN: "Unknown",
};

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manually entered",
  CMS_PUF: "CMS public formulary data",
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
    }, 250);
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
      <h1>Check medication coverage</h1>

      <div className="search-grid">
        <div className="search-field">
          <label htmlFor="med-search">Medication</label>
          <input
            id="med-search"
            placeholder="Search by name or NDC…"
            value={selectedMed ? selectedMed.name : medQuery}
            onChange={(e) => {
              setSelectedMed(null);
              setResult(null);
              setMedQuery(e.target.value);
            }}
          />
          {!selectedMed && medResults.length > 0 && (
            <ul className="suggestions">
              {medResults.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setSelectedMed(m)}>
                    <strong>{m.name}</strong>
                    {m.strength && <span className="muted"> · {m.strength}</span>}
                    {m.drugClass && <span className="muted"> · {m.drugClass}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="search-field">
          <label htmlFor="plan-search">Insurance plan</label>
          <input
            id="plan-search"
            placeholder="Search by payer or plan name…"
            value={selectedPlan ? `${selectedPlan.payerName} — ${selectedPlan.planName}` : planQuery}
            onChange={(e) => {
              setSelectedPlan(null);
              setResult(null);
              setPlanQuery(e.target.value);
            }}
          />
          {!selectedPlan && planResults.length > 0 && (
            <ul className="suggestions">
              {planResults.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelectedPlan(p)}>
                    <strong>{p.payerName}</strong> — {p.planName}
                    {p.planType && <span className="muted"> · {p.planType}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {checking && <p className="muted">Checking coverage…</p>}
      {error && <div className="error">{error}</div>}

      {result && (
        <div className={`card result-card ${result.coverage.covered ? "covered" : "not-covered"}`}>
          <div className="result-header">
            <div>
              <h2>{result.medication.name}</h2>
              <p className="muted">
                {result.plan.payerName} — {result.plan.planName}
              </p>
            </div>
            <div className={`status-badge ${result.coverage.covered ? "status-covered" : "status-not-covered"}`}>
              {result.coverage.covered ? "Covered" : "Not covered"}
            </div>
          </div>

          <dl className="result-details">
            <div>
              <dt>Formulary tier</dt>
              <dd>{TIER_LABELS[result.coverage.tier] ?? result.coverage.tier}</dd>
            </div>
            {result.coverage.estimatedCost && (
              <div>
                <dt>Estimated patient cost</dt>
                <dd>{result.coverage.estimatedCost}</dd>
              </div>
            )}
            {result.coverage.quantityLimit && (
              <div>
                <dt>Quantity limit</dt>
                <dd>{result.coverage.quantityLimit}</dd>
              </div>
            )}
            <div>
              <dt>Data source</dt>
              <dd>{SOURCE_LABELS[result.coverage.source] ?? result.coverage.source}</dd>
            </div>
          </dl>

          <div className="flags">
            {result.coverage.priorAuthRequired && <span className="flag flag-warn">Prior authorization required</span>}
            {result.coverage.stepTherapyRequired && <span className="flag flag-warn">Step therapy required</span>}
            {!result.coverage.priorAuthRequired && !result.coverage.stepTherapyRequired && result.coverage.covered && (
              <span className="flag flag-ok">No prior auth or step therapy on file</span>
            )}
          </div>

          {result.coverage.notes && <p className="muted">{result.coverage.notes}</p>}

          {result.alternatives.length > 0 && (
            <div className="alternatives">
              <h3>Covered alternatives ({result.medication.drugClass})</h3>
              <ul>
                {result.alternatives.map((alt) => (
                  <li key={alt.id}>
                    <strong>{alt.name}</strong> — {TIER_LABELS[alt.tier] ?? alt.tier}
                    {alt.estimatedCost && <span className="muted"> · {alt.estimatedCost}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
