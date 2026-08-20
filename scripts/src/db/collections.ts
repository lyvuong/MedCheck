import { firestore } from "./firestore.js";

export type UserRole = "ADMIN" | "DOCTOR" | "STAFF";
export type DataSource = "MANUAL" | "CMS_PUF" | "WENO";
export type CoverageTier =
  | "TIER_1_PREFERRED_GENERIC"
  | "TIER_2_GENERIC"
  | "TIER_3_PREFERRED_BRAND"
  | "TIER_4_NON_PREFERRED_DRUG"
  | "TIER_5_SPECIALTY"
  | "NOT_COVERED"
  | "UNKNOWN";

export interface User {
  id: string; // doc id == lowercase email
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  npi?: string | null;
  active: boolean;
  createdAt: Date;
}

export interface InsurancePlan {
  id: string;
  payerName: string;
  planName: string;
  planType?: string | null;
  contractId?: string | null;
  planId?: string | null;
  segmentId?: string | null;
  planYear?: number | null;
  state?: string | null;
  dataSource: DataSource;
  sourceUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  id: string; // doc id == ndc when known, else auto-id
  name: string;
  genericName?: string | null;
  ndc?: string | null;
  rxcui?: string | null;
  drugClass?: string | null;
  strength?: string | null;
  form?: string | null;
  createdAt: Date;
}

export interface FormularyEntry {
  id: string; // doc id == `${planId}_${medicationId}`
  planId: string;
  medicationId: string;
  tier: CoverageTier;
  covered: boolean;
  priorAuthRequired: boolean;
  stepTherapyRequired: boolean;
  quantityLimit?: string | null;
  estimatedCopayCents?: number | null;
  estimatedCoinsurancePct?: number | null;
  notes?: string | null;
  dataSource: DataSource;
  sourceUpdatedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LookupLog {
  id: string;
  userId: string;
  medicationQuery: string;
  planId?: string | null;
  resultSummary?: string | null;
  createdAt: Date;
}

export const usersCol = firestore.collection("users");
export const insurancePlansCol = firestore.collection("insurancePlans");
export const medicationsCol = firestore.collection("medications");
export const formularyEntriesCol = firestore.collection("formularyEntries");
export const lookupLogsCol = firestore.collection("lookupLogs");
