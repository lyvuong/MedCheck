import { useEffect, useState, type FormEvent } from "react";
import { createManualPlan } from "../data/insurancePlans";
import { createManualMedication } from "../data/medications";
import { upsertEntry } from "../data/formularyEntries";
import { listUserRoleDocs, setUserRole, setUserActive } from "../data/users";
import type { UserRole, UserRoleDoc } from "../data/types";

const TIERS = [
  "TIER_1_PREFERRED_GENERIC",
  "TIER_2_GENERIC",
  "TIER_3_PREFERRED_BRAND",
  "TIER_4_NON_PREFERRED_DRUG",
  "TIER_5_SPECIALTY",
  "NOT_COVERED",
  "UNKNOWN",
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
              <option value="DOCTOR">Doctor (Coverage Lookup & Alternatives)</option>
              <option value="STAFF">Staff (Lookup + Manual Formulary Entry)</option>
              <option value="ADMIN">Admin (Full Control & User Management)</option>
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
                      <span className={`role-badge role-${u.role.toLowerCase()}`}>{u.role}</span>
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
  const [message, setMessage] = useState<string | null>(null);

  async function submitPlan(e: FormEvent) {
    e.preventDefault();
    const plan = await createManualPlan(planForm);
    setMessage(`Created plan "${plan.planName}" (id: ${plan.id})`);
    setPlanForm({ payerName: "", planName: "", planType: "", state: "" });
  }

  async function submitMed(e: FormEvent) {
    e.preventDefault();
    const medication = await createManualMedication(medForm);
    setMessage(`Created medication "${medication.name}" (id: ${medication.id})`);
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
    setMessage("Formulary entry saved");
  }

  return (
    <div className="formulary-management-grid">
      <div className="formulary-sub-row">
        <form className="card" onSubmit={submitPlan}>
          <h3>➕ Add Insurance Plan</h3>
          <label>
            <span>Payer Name</span>
            <input
              placeholder="e.g. Aetna, Blue Cross"
              value={planForm.payerName}
              onChange={(e) => setPlanForm({ ...planForm, payerName: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Plan Name</span>
            <input
              placeholder="e.g. Choice POS II"
              value={planForm.planName}
              onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Plan Type</span>
            <input
              placeholder="e.g. HMO, PPO, Part D"
              value={planForm.planType}
              onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}
            />
          </label>
          <button type="submit" className="primary-button" style={{ width: "100%", marginTop: "0.5rem" }}>
            Add Plan
          </button>
        </form>

        <form className="card" onSubmit={submitMed}>
          <h3>➕ Add Medication</h3>
          <label>
            <span>Medication Brand / Name</span>
            <input
              placeholder="e.g. Lipitor 20mg Tablet"
              value={medForm.name}
              onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Therapeutic Drug Class</span>
            <input
              value={medForm.drugClass}
              onChange={(e) => setMedForm({ ...medForm, drugClass: e.target.value })}
              placeholder="e.g. Statin — for alternative search"
            />
          </label>
          <label>
            <span>Strength & Dosage Form</span>
            <input
              placeholder="e.g. 20mg Oral Tablet"
              value={medForm.strength}
              onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })}
            />
          </label>
          <button type="submit" className="primary-button" style={{ width: "100%", marginTop: "0.5rem" }}>
            Add Medication
          </button>
        </form>
      </div>

      <form className="card" onSubmit={submitEntry}>
        <h3>🔗 Link Formulary Rule</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0" }}>
          Requires the Plan ID and Medication ID from above.
        </p>

        <div className="formulary-inputs-grid">
          <label>
            <span>Plan ID</span>
            <input
              placeholder="Paste generated plan ID"
              value={entryForm.planId}
              onChange={(e) => setEntryForm({ ...entryForm, planId: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Medication ID</span>
            <input
              placeholder="Paste generated medication ID"
              value={entryForm.medicationId}
              onChange={(e) => setEntryForm({ ...entryForm, medicationId: e.target.value })}
              required
            />
          </label>
          <label>
            <span>Formulary Tier</span>
            <select
              value={entryForm.tier}
              onChange={(e) => setEntryForm({ ...entryForm, tier: e.target.value })}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Estimated Copay ($)</span>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 15.00"
              value={entryForm.estimatedCopayCents}
              onChange={(e) => setEntryForm({ ...entryForm, estimatedCopayCents: e.target.value })}
            />
          </label>
        </div>

        <div className="formulary-checkboxes-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={entryForm.covered}
              onChange={(e) => setEntryForm({ ...entryForm, covered: e.target.checked })}
            />
            <span>Covered by Plan</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={entryForm.priorAuthRequired}
              onChange={(e) => setEntryForm({ ...entryForm, priorAuthRequired: e.target.checked })}
            />
            <span>Prior Authorization Required</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={entryForm.stepTherapyRequired}
              onChange={(e) => setEntryForm({ ...entryForm, stepTherapyRequired: e.target.checked })}
            />
            <span>Step Therapy Mandated</span>
          </label>
        </div>

        <button type="submit" className="primary-button" style={{ marginTop: "1rem" }}>
          Save Formulary Entry
        </button>

        {message && (
          <div className="alert-banner success" style={{ marginTop: "1rem" }}>
            ✓ {message}
          </div>
        )}
      </form>
    </div>
  );
}
