export type UserRole = "ADMIN" | "DOCTOR" | "STAFF";
export type DataSource = "MANUAL" | "CMS_PUF" | "WENO";

export interface AuthedUser {
  id: string; // == email
  email: string;
  role: UserRole;
  name: string;
}

export interface UserRoleDoc {
  email: string; // == doc id
  role: UserRole;
  name?: string | null;
  npi?: string | null;
  active: boolean;
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
  dataSource: DataSource;
}

export interface FormularyEntry {
  id: string;
  planId: string;
  medicationId: string;
  tier: string;
  covered: boolean;
  priorAuthRequired: boolean;
  stepTherapyRequired: boolean;
  quantityLimit?: string | null;
  estimatedCopayCents?: number | null;
  estimatedCoinsurancePct?: number | null;
  notes?: string | null;
  dataSource: DataSource;
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
