const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

let currentToken: string | null = localStorage.getItem("medcheck_token");

export function setToken(token: string | null) {
  currentToken = token;
  if (token) localStorage.setItem("medcheck_token", token);
  else localStorage.removeItem("medcheck_token");
}

export function getToken() {
  return currentToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AuthedUser {
  id: string;
  email: string;
  role: "ADMIN" | "DOCTOR" | "STAFF";
  name: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName: string | null;
  ndc: string | null;
  drugClass: string | null;
  strength: string | null;
  form: string | null;
}

export interface InsurancePlan {
  id: string;
  payerName: string;
  planName: string;
  planType: string | null;
  state: string | null;
  dataSource: "MANUAL" | "CMS_PUF" | "WENO";
}

export interface CoverageCheckResult {
  plan: { id: string; payerName: string; planName: string };
  medication: { id: string; name: string; drugClass: string | null };
  coverage: {
    covered: boolean;
    tier: string;
    priorAuthRequired: boolean;
    stepTherapyRequired: boolean;
    quantityLimit: string | null;
    estimatedCost: string | null;
    notes: string | null;
    source: string;
  };
  alternatives: { id: string; name: string; tier: string; estimatedCost: string | null }[];
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthedUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: AuthedUser }>("/auth/me"),
  searchMedications: (q: string) =>
    request<{ medications: Medication[] }>(`/medications/search?q=${encodeURIComponent(q)}`),
  searchPlans: (q: string) =>
    request<{ plans: InsurancePlan[] }>(`/plans/search?q=${encodeURIComponent(q)}`),
  checkCoverage: (planId: string, medicationId: string) =>
    request<CoverageCheckResult>(`/coverage/check?planId=${planId}&medicationId=${medicationId}`),
  listUsers: () =>
    request<{ users: (AuthedUser & { active: boolean })[] }>("/auth/users"),
  createUser: (data: { email: string; password: string; name: string; role: string }) =>
    request("/auth/users", { method: "POST", body: JSON.stringify(data) }),
  setUserActive: (id: string, active: boolean) =>
    request(`/auth/users/${id}/active`, { method: "PATCH", body: JSON.stringify({ active }) }),
  createPlan: (data: { payerName: string; planName: string; planType?: string; state?: string }) =>
    request<{ plan: InsurancePlan }>("/admin/plans", { method: "POST", body: JSON.stringify(data) }),
  createMedication: (data: Partial<Medication> & { name: string }) =>
    request<{ medication: Medication }>("/admin/medications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  upsertFormularyEntry: (data: {
    planId: string;
    medicationId: string;
    tier: string;
    covered: boolean;
    priorAuthRequired?: boolean;
    stepTherapyRequired?: boolean;
    quantityLimit?: string;
    estimatedCopayCents?: number;
    estimatedCoinsurancePct?: number;
  }) => request("/admin/formulary-entries", { method: "POST", body: JSON.stringify(data) }),
};
