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
      <h1>Admin</h1>
      <div className="tabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Users
        </button>
        <button className={tab === "formulary" ? "active" : ""} onClick={() => setTab("formulary")}>
          Formulary entry
        </button>
      </div>
      {tab === "users" ? <UsersPanel /> : <FormularyPanel />}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<UserRoleDoc[]>([]);
  const [form, setForm] = useState({ email: "", name: "", role: "STAFF" as UserRole });
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    listUserRoleDocs().then(setUsers);
  }
  useEffect(refresh, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await setUserRole(form.email, form.role, form.name);
      setForm({ email: "", name: "", role: "STAFF" });
      setMessage(`Granted ${form.role} access to ${form.email}`);
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to grant access");
    }
  }

  return (
    <div className="admin-grid">
      <form className="card" onSubmit={onSubmit}>
        <h3>Grant access</h3>
        <p className="muted">
          The person still needs to sign in with this Google account themselves — this only decides what they can
          see once they do.
        </p>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <label>
          Google account email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            <option value="DOCTOR">Doctor</option>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <button type="submit">Grant access</button>
        {message && <p className="muted">{message}</p>}
      </form>

      <div className="card">
        <h3>Existing users</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.active ? "Active" : "Disabled"}</td>
                <td>
                  <button
                    className="link-button"
                    onClick={() => setUserActive(u.email, !u.active).then(refresh)}
                  >
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div className="admin-grid">
      <form className="card" onSubmit={submitPlan}>
        <h3>Add insurance plan</h3>
        <label>
          Payer name
          <input
            value={planForm.payerName}
            onChange={(e) => setPlanForm({ ...planForm, payerName: e.target.value })}
            required
          />
        </label>
        <label>
          Plan name
          <input
            value={planForm.planName}
            onChange={(e) => setPlanForm({ ...planForm, planName: e.target.value })}
            required
          />
        </label>
        <label>
          Plan type
          <input value={planForm.planType} onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })} />
        </label>
        <button type="submit">Add plan</button>
      </form>

      <form className="card" onSubmit={submitMed}>
        <h3>Add medication</h3>
        <label>
          Name
          <input value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} required />
        </label>
        <label>
          Drug class
          <input
            value={medForm.drugClass}
            onChange={(e) => setMedForm({ ...medForm, drugClass: e.target.value })}
            placeholder="e.g. Statin — used for alternative suggestions"
          />
        </label>
        <label>
          Strength
          <input value={medForm.strength} onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })} />
        </label>
        <button type="submit">Add medication</button>
      </form>

      <form className="card" onSubmit={submitEntry}>
        <h3>Set formulary entry</h3>
        <p className="muted">Requires the plan ID and medication ID from above (copy from the confirmation messages).</p>
        <label>
          Plan ID
          <input value={entryForm.planId} onChange={(e) => setEntryForm({ ...entryForm, planId: e.target.value })} required />
        </label>
        <label>
          Medication ID
          <input
            value={entryForm.medicationId}
            onChange={(e) => setEntryForm({ ...entryForm, medicationId: e.target.value })}
            required
          />
        </label>
        <label>
          Tier
          <select value={entryForm.tier} onChange={(e) => setEntryForm({ ...entryForm, tier: e.target.value })}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={entryForm.covered}
            onChange={(e) => setEntryForm({ ...entryForm, covered: e.target.checked })}
          />
          Covered
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={entryForm.priorAuthRequired}
            onChange={(e) => setEntryForm({ ...entryForm, priorAuthRequired: e.target.checked })}
          />
          Prior authorization required
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={entryForm.stepTherapyRequired}
            onChange={(e) => setEntryForm({ ...entryForm, stepTherapyRequired: e.target.checked })}
          />
          Step therapy required
        </label>
        <label>
          Estimated copay ($)
          <input
            type="number"
            step="0.01"
            value={entryForm.estimatedCopayCents}
            onChange={(e) => setEntryForm({ ...entryForm, estimatedCopayCents: e.target.value })}
          />
        </label>
        <button type="submit">Save entry</button>
      </form>

      {message && <p className="muted">{message}</p>}
    </div>
  );
}
