/**
 * CMS's "Prescription Drug Plan Formulary, Pharmacy Network, and Pricing
 * Information" files are public and free (no contract, no API key —
 * https://www.cms.gov/research-statistics-data-and-systems/files-for-order/nonidentifiabledatafiles/prescriptiondrugplanformularypharmacynetworkandpricinginformationfiles),
 * but they're distributed as large CSVs you download yourself after
 * accepting CMS's terms of use — there's no click-through API. They cover
 * Medicare Advantage / Part D plans and (separately) ACA Marketplace
 * issuers publish similar machine-readable formulary files under CMS
 * price-transparency rules. They do NOT cover employer/commercial group
 * plans.
 *
 * Column names have varied slightly release to release. Rather than
 * hardcoding names that might not match the exact file you download,
 * this mapping is the one place to adjust them — open your CSV's header
 * row, compare, and edit the strings below before running `npm run
 * import:cms`.
 */
export const PLAN_FILE_COLUMNS = {
  contractId: "CONTRACT_ID",
  planId: "PLAN_ID",
  segmentId: "SEGMENT_ID",
  planName: "PLAN_NAME",
  payerName: "ORG_NAME",
  planType: "PLAN_TYPE",
  state: "STATE",
  year: "CONTRACT_YEAR",
};

export const FORMULARY_FILE_COLUMNS = {
  contractId: "CONTRACT_ID",
  planId: "PLAN_ID",
  segmentId: "SEGMENT_ID",
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
