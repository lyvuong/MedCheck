/**
 * CMS's "Prescription Drug Plan Formulary, Pharmacy Network, and Pricing
 * Information" files are public and free — get them from
 * https://data.cms.gov (search "Medicare Part D Prescribers" category,
 * then pick the "Monthly" or "Quarterly Prescription Drug Plan
 * Formulary, Pharmacy Network, and Pricing Information" dataset, NOT the
 * prescriber-utilization datasets in that same list). You review/accept
 * CMS's "Agreement for Use" yourself — there's no click-through API.
 * They're distributed as pipe (`|`) -delimited `.txt` files, not CSV,
 * despite how they're often described — the importer auto-detects the
 * delimiter either way. They cover Medicare Advantage / Part D plans;
 * ACA Marketplace issuers publish formulary data separately, as JSON
 * files per-issuer, in a completely different format this importer does
 * not read. Neither covers employer/commercial group plans.
 *
 * Column names have varied slightly release to release, and — important
 * — the Basic Drugs Formulary file has NO plan identifier of its own.
 * Plans and formularies link only through FORMULARY_ID (one formulary is
 * commonly shared by several plans), not through CONTRACT_ID/PLAN_ID
 * directly. importCli.ts builds that link in memory from the plan file
 * before touching the formulary file. If CMS renames a column in a
 * future release, this is the one place to fix it — open your file's
 * header row, compare, and edit the strings below.
 */
export const PLAN_FILE_COLUMNS = {
  contractId: "CONTRACT_ID",
  planId: "PLAN_ID",
  segmentId: "SEGMENT_ID",
  planName: "PLAN_NAME",
  payerName: "CONTRACT_NAME",
  formularyId: "FORMULARY_ID",
  state: "STATE",
  // No plan-type (HMO/PPO/...) column exists in this file at all —
  // planType is left unset on import; backfill it by hand from the
  // Admin panel if you want it.
};

export const FORMULARY_FILE_COLUMNS = {
  formularyId: "FORMULARY_ID",
  ndc: "NDC",
  rxcui: "RXCUI",
  tierLevel: "TIER_LEVEL_VALUE",
  quantityLimitFlag: "QUANTITY_LIMIT_YN",
  quantityLimitAmount: "QUANTITY_LIMIT_AMOUNT",
  quantityLimitDays: "QUANTITY_LIMIT_DAYS",
  priorAuthFlag: "PRIOR_AUTHORIZATION_YN",
  stepTherapyFlag: "STEP_THERAPY_YN",
};

/** Maps a raw numeric/text tier value from the file to our CoverageTier enum. */
export function mapTier(raw: string | undefined):
  | "TIER_1_PREFERRED_GENERIC"
  | "TIER_2_GENERIC"
  | "TIER_3_PREFERRED_BRAND"
  | "TIER_4_NON_PREFERRED_DRUG"
  | "TIER_5_SPECIALTY"
  | "UNKNOWN" {
  switch ((raw ?? "").trim()) {
    case "1":
      return "TIER_1_PREFERRED_GENERIC";
    case "2":
      return "TIER_2_GENERIC";
    case "3":
      return "TIER_3_PREFERRED_BRAND";
    case "4":
      return "TIER_4_NON_PREFERRED_DRUG";
    case "5":
    case "6":
      return "TIER_5_SPECIALTY";
    default:
      return "UNKNOWN";
  }
}

export function yn(raw: string | undefined): boolean {
  return (raw ?? "").trim().toUpperCase() === "Y";
}
