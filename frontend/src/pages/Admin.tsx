import { useEffect, useState, type FormEvent } from "react";
import { createManualPlan } from "../data/insurancePlans";
import { createManualMedication } from "../data/medications";
import { upsertEntry } from "../data/formularyEntries";
import { listUserRoleDocs, setUserRole, setUserActive } from "../data/users";
import type { UserRole, UserRoleDoc } from "../data/types";
import { ROLE_ICONS } from "../utils/roles";

const TIERS = [
  { key: "TIER_1_PREFERRED_GENERIC", label: "Tier 1 — Preferred Generic (Lowest Copay)" },
  { key: "TIER_2_GENERIC", label: "Tier 2 — Generic / Preferred Brand" },
  { key: "TIER_3_PREFERRED_BRAND", label: "Tier 3 — Non-Preferred Brand" },
  { key: "TIER_4_NON_PREFERRED_DRUG", label: "Tier 4 — Non-Preferred / High Cost" },
  { key: "TIER_5_SPECIALTY", label: "Tier 5 — Specialty Biologics (High Coinsurance)" },
  { key: "NOT_COVERED", label: "Not Covered (100% Patient Out-of-Pocket)" },
  { key: "UNKNOWN", label: "Unknown / Unclassified" },
];

export function Admin() {
  const [tab, setTab] = useState<"users" | "formulary">("users");

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>
          <span>⚙️</span> Administration Portal
        </h1>
        <p className="muted">Manage staff access permissions, insurance plans, medications, and custom formulary entries</p>
      </div>

      <div className="admin-tabs-bar">
        <button
          className={`admin-tab-btn ${tab === "users" ? "active" : ""}`}
          onClick={() => setTab("users")}
        >
          <span>👥</span> Users & Access
        </button>
        <button
          className={`admin-tab-btn ${tab === "formulary" ? "active" : ""}`}
          onClick={() => setTab("formulary")}
        >
          <span>📋</span> Formulary Entry
        </button>
      </div>

      {tab === "users" ? <UsersPanel /> : <FormularyPanel />}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<UserRoleDoc[]>([]);
  const [form, setForm] = useState({ email: "", name: "", role: "STAFF" as UserRole });
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(false);

  function refresh() {
    setLoading(true);
    listUserRoleDocs()
      .then(setUsers)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await setUserRole(form.email, form.role, form.name);
      setForm({ email: "", name: "", role: "STAFF" });
      setMessage({ text: `Granted ${form.role} access to ${form.email}`, type: "success" });
      refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to grant access", type: "error" });
    }
  }

  return (
    <div className="users-management-grid">
      {/* Grant Access Form Card */}
      <div className="card user-form-card">
        <div className="card-header-icon">
          <span className="icon-circle">➕</span>
          <div>
            <h3>Grant User Access</h3>
            <p className="card-subtitle">Authorize a Google account for practice access</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="user-form">
          <label>
            <span>Display Name</span>
            <input
              placeholder="e.g. Dr. Sarah Jenkins"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>

          <label>
            <span>Google Account Email</span>
            <input
              type="email"
              placeholder="name@clinic.org or gmail.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>

          <label>
            <span>Assigned Role</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="DOCTOR">{ROLE_ICONS.DOCTOR} Doctor (Coverage Lookup & Alternatives)</option>
              <option value="STAFF">{ROLE_ICONS.STAFF} Staff (Lookup + Manual Formulary Entry)</option>
              <option value="ADMIN">{ROLE_ICONS.ADMIN} Admin (Full Control & User Management)</option>
            </select>
          </label>

          <p className="field-hint">
            💡 The user must sign in with this exact Google address.
          </p>

          <button type="submit" className="primary-button" style={{ width: "100%", marginTop: "0.5rem" }}>
            Grant Access
          </button>

          {message && (
            <div className={`alert-banner ${message.type}`}>
              {message.type === "success" ? "✓ " : "⚠️ "}
              {message.text}
            </div>
          )}
        </form>
      </div>

      {/* Existing Users Directory Card */}
      <div className="card user-directory-card">
        <div className="card-header-row">
          <div className="card-header-icon">
            <span className="icon-circle">👥</span>
            <div>
              <h3>Authorized Users</h3>
              <p className="card-subtitle">Manage registered clinicians and team members</p>
            </div>
          </div>
          <span className="user-count-pill">{users.length} Users Registered</span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="user-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const initials = (u.name || u.email)
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <tr key={u.email} className={!u.active ? "row-disabled" : ""}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-mini">{initials}</div>
                        <span className="user-name-text">{u.name || "Unnamed"}</span>
                      </div>
                    </td>
                    <td>
                      <span className="user-email-text">{u.email}</span>
                    </td>
                    <td>
                      <span className={`role-badge role-${u.role.toLowerCase()}`}>
                        {ROLE_ICONS[u.role]} {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${u.active ? "active" : "disabled"}`}>
                        <span className="status-dot" />
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className={`action-btn ${u.active ? "btn-disable" : "btn-enable"}`}
                        onClick={() => setUserActive(u.email, !u.active).then(refresh)}
                      >
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    No authorized user role documents found. Use the form on the left to add users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FormularyPanel() {
  const [planForm, setPlanForm] = useState({ payerName: "", planName: "", planType: "", state: "" });
  const [medForm, setMedForm] = useState({ name: "", genericName: "", drugClass: "", strength: "", form: "" });
  const [entryForm, setEntryForm] = useState({
    planId: "",
    medicationId: "",
    tier: "TIER_1_PREFERRED_GENERIC",
    covered: true,
    priorAuthRequired: false,
    stepTherapyRequired: false,
    quantityLimit: "",
    estimatedCopayCents: "",
  });

  const [planSuccess, setPlanSuccess] = useState<{ name: string; id: string } | null>(null);
  const [medSuccess, setMedSuccess] = useState<{ name: string; id: string } | null>(null);
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);

  async function submitPlan(e: FormEvent) {
    e.preventDefault();
    const plan = await createManualPlan(planForm);
    setPlanSuccess({ name: plan.planName, id: plan.id });
    setPlanForm({ payerName: "", planName: "", planType: "", state: "" });
  }

  async function submitMed(e: FormEvent) {
    e.preventDefault();
    const medication = await createManualMedication(medForm);
    setMedSuccess({ name: medication.name, id: medication.id });
    setMedForm({ name: "", genericName: "", drugClass: "", strength: "", form: "" });
  }

  async function submitEntry(e: FormEvent) {
    e.preventDefault();
    await upsertEntry({
      ...entryForm,
      estimatedCopayCents: entryForm.estimatedCopayCents
        ? Math.round(Number(entryForm.estimatedCopayCents) * 100)
        : undefined,
    });
    setEntrySuccess(`Saved formulary rule linking Plan [${entryForm.planId}] & Medication [${entryForm.medicationId}]`);
  }

  return (
    <div className="formulary-management-grid">
      {/* Workflow Step Indicator */}
      <div className="card formulary-pipeline-card">
        <div className="pipeline-header">
          <span className="pipeline-badge">3-Step Workflow</span>
          <h3>Manual Formulary Entry Pipeline</h3>
        </div>
        <div className="pipeline-steps">
          <div className="pipeline-step">
            <span className="step-num">1</span>
            <div className="step-info">
              <strong>Register Insurance Plan</strong>
              <p>Add payer and plan details to get a Plan ID</p>
            </div>
          </div>
          <div className="step-connector">➔</div>
          <div className="pipeline-step">
            <span className="step-num">2</span>
            <div className="step-info">
              <strong>Register Medication</strong>
              <p>Add brand name, strength, and therapeutic class</p>
            </div>
          </div>
          <div className="step-connector">➔</div>
          <div className="pipeline-step">
            <span className="step-num">3</span>
            <div className="step-info">
              <strong>Link Formulary Rule</strong>
              <p>Set tier, copay, and PA/ST policy flags</p>
            </div>
          </div>
        </div>
      </div>

      {/* Steps 1 & 2: Dual Creation Pods */}
      <div className="formulary-sub-row">
        {/* Step 1: Add Insurance Plan */}
        <div className="card formulary-card">
          <div className="card-header-icon">
            <span className="icon-circle">🛡️</span>
            <div>
              <h3>Step 1: Add Insurance Plan</h3>
              <p className="card-subtitle">Register a commercial or Medicare payer</p>
            </div>
          </div>

          <form onSubmit={submitPlan} className="admin-form">
            <label>
              <span>Payer Name</span>
              <input
                placeholder="e.g. Aetna, Blue Cross, UnitedHealthcare"
                value={planForm.payerName}
                onChange={(e) => setPlanForm({ ...planForm, payerName: e.target.value })}
                required
              />
            </label>
            <label>
              <span>Plan Name</span>
              <input
                placeholder="e.g. Choice POS II, Premier PPO"
                value={planForm.planName}
                onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })}
                required
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
              <label>
                <span>Plan Type</span>
                <input
                  placeholder="e.g. HMO, PPO, Part D"
                  value={planForm.planType}
                  onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}
                />
              </label>
              <label>
                <span>State</span>
                <input
                  placeholder="e.g. TX, CA, US"
                  value={planForm.state}
                  onChange={(e) => setPlanForm({ ...planForm, state: e.target.value })}
                />
              </label>
            </div>

            <button type="submit" className="primary-button" style={{ width: "100%", marginTop: "0.5rem" }}>
              Register Plan
            </button>

            {planSuccess && (
              <div className="alert-banner success" style={{ marginTop: "0.85rem" }}>
                <div>✓ Created plan <strong>"{planSuccess.name}"</strong></div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.4rem" }}>
                  <code style={{ fontSize: "0.75rem" }}>{planSuccess.id}</code>
                  <button
                    type="button"
                    className="action-btn btn-enable"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                    onClick={() => setEntryForm({ ...entryForm, planId: planSuccess.id })}
                  >
                    👉 Insert in Step 3
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Step 2: Add Medication */}
        <div className="card formulary-card">
          <div className="card-header-icon">
            <span className="icon-circle">💊</span>
            <div>
              <h3>Step 2: Add Medication</h3>
              <p className="card-subtitle">Register brand, generic, and drug class</p>
            </div>
          </div>

          <form onSubmit={submitMed} className="admin-form">
            <label>
              <span>Medication Brand / Name</span>
              <input
                placeholder="e.g. Ozempic 2mg/3mL Pen, Lipitor 20mg"
                value={medForm.name}
                onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                required
              />
            </label>
            <label>
              <span>Therapeutic Drug Class</span>
              <input
                placeholder="e.g. GLP-1 Agonist, Statin, DOAC"
                value={medForm.drugClass}
                onChange={(e) => setMedForm({ ...medForm, drugClass: e.target.value })}
              />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <label>
                <span>Generic Name</span>
                <input
                  placeholder="e.g. Semaglutide, Atorvastatin"
                  value={medForm.genericName}
                  onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value })}
                />
              </label>
              <label>
                <span>Strength / Form</span>
                <input
                  placeholder="e.g. 2mg/3mL Pen, 20mg Tab"
                  value={medForm.strength}
                  onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })}
                />
              </label>
            </div>

            <button type="submit" className="primary-button" style={{ width: "100%", marginTop: "0.5rem" }}>
              Register Medication
            </button>

            {medSuccess && (
              <div className="alert-banner success" style={{ marginTop: "0.85rem" }}>
                <div>✓ Created medication <strong>"{medSuccess.name}"</strong></div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.4rem" }}>
                  <code style={{ fontSize: "0.75rem" }}>{medSuccess.id}</code>
                  <button
                    type="button"
                    className="action-btn btn-enable"
                    style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                    onClick={() => setEntryForm({ ...entryForm, medicationId: medSuccess.id })}
                  >
                    👉 Insert in Step 3
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Step 3: Link Formulary Rule Hero Card */}
      <div className="card formulary-hero-card">
        <div className="card-header-icon">
          <span className="icon-circle">🔗</span>
          <div>
            <h3>Step 3: Link Formulary Rule & Cost Sharing</h3>
            <p className="card-subtitle">Connect plan and drug with tier ranking, patient copay, and policy mandates</p>
          </div>
        </div>

        <form onSubmit={submitEntry} className="formulary-rule-form">
          <div className="formulary-inputs-grid">
            <label>
              <span>Target Plan ID</span>
              <input
                placeholder="e.g. manual_aetna_choice_pos_ii"
                value={entryForm.planId}
                onChange={(e) => setEntryForm({ ...entryForm, planId: e.target.value })}
                required
              />
            </label>

            <label>
              <span>Target Medication ID</span>
              <input
                placeholder="e.g. manual_ozempic_2mg_3ml_pen"
                value={entryForm.medicationId}
                onChange={(e) => setEntryForm({ ...entryForm, medicationId: e.target.value })}
                required
              />
            </label>

            <label>
              <span>Formulary Tier Ranking</span>
              <select
                value={entryForm.tier}
                onChange={(e) => setEntryForm({ ...entryForm, tier: e.target.value })}
              >
                {TIERS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Estimated Patient Copay ($)</span>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 15.00 or 45.00"
                value={entryForm.estimatedCopayCents}
                onChange={(e) => setEntryForm({ ...entryForm, estimatedCopayCents: e.target.value })}
              />
            </label>
          </div>

          {/* Toggle Switches for Coverage & Requirements */}
          <div className="policy-toggles-grid">
            <label className={`toggle-card ${entryForm.covered ? "toggle-active" : ""}`}>
              <input
                type="checkbox"
                checked={entryForm.covered}
                onChange={(e) => setEntryForm({ ...entryForm, covered: e.target.checked })}
              />
              <div className="toggle-info">
                <strong>{entryForm.covered ? "✅ Covered by Plan" : "❌ Not Covered"}</strong>
                <span>Medication is approved under plan formulary</span>
              </div>
            </label>

            <label className={`toggle-card ${entryForm.priorAuthRequired ? "toggle-warn" : ""}`}>
              <input
                type="checkbox"
                checked={entryForm.priorAuthRequired}
                onChange={(e) => setEntryForm({ ...entryForm, priorAuthRequired: e.target.checked })}
              />
              <div className="toggle-info">
                <strong>{entryForm.priorAuthRequired ? "⚠️ Prior Auth (PA) Required" : "✓ No Prior Auth Required"}</strong>
                <span>Physician clinical paperwork review needed</span>
              </div>
            </label>

            <label className={`toggle-card ${entryForm.stepTherapyRequired ? "toggle-warn" : ""}`}>
              <input
                type="checkbox"
                checked={entryForm.stepTherapyRequired}
                onChange={(e) => setEntryForm({ ...entryForm, stepTherapyRequired: e.target.checked })}
              />
              <div className="toggle-info">
                <strong>{entryForm.stepTherapyRequired ? "⚠️ Step Therapy (ST) Mandated" : "✓ No Step Therapy Mandated"}</strong>
                <span>First-line generic trial required before approval</span>
              </div>
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button type="submit" className="primary-button" style={{ padding: "0.85rem 2rem" }}>
              💾 Save Formulary Rule
            </button>
          </div>

          {entrySuccess && (
            <div className="alert-banner success" style={{ marginTop: "1.25rem" }}>
              ✓ {entrySuccess}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
