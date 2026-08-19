import type { InsurancePlan, Medication, CoverageTier } from "../db/collections.js";

/**
 * A CoverageResult is the normalized shape every data source (manual entry,
 * CMS bulk import, a live API like Weno) ultimately produces. The rest of
 * the app only ever deals with this shape, never with a provider's raw
 * response format.
 */
export interface CoverageResult {
  covered: boolean;
  tier: CoverageTier;
  priorAuthRequired: boolean;
  stepTherapyRequired: boolean;
  quantityLimit?: string | null;
  estimatedCopayCents?: number | null;
  estimatedCoinsurancePct?: number | null;
  notes?: string | null;
  source: "MANUAL" | "CMS_PUF" | "WENO";
  sourceUpdatedAt?: Date | null;
}

/**
 * Providers that can answer "is this drug covered under this plan?" live,
 * at request time, rather than only through a pre-loaded bulk import.
 *
 * Manual entry and the CMS PUF importer both just write rows into
 * formulary_entries ahead of time (see providers/cms/importCli.ts and the
 * admin CRUD routes) — the coverage-check endpoint reads those rows
 * directly and never needs a "live" provider for them. A provider like
 * Weno is different: it's a real-time transaction against a third-party
 * API, so it implements this interface and is only consulted when no
 * local formulary_entries row exists yet for the plan/medication pair.
 */
export interface LiveFormularyProvider {
  readonly id: "WENO";
  readonly enabled: boolean;
  checkCoverage(input: {
    plan: InsurancePlan;
    medication: Medication;
  }): Promise<CoverageResult | null>;
}
