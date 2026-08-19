import type { LiveFormularyProvider, CoverageResult } from "../types.js";

/**
 * Stub adapter for Weno Exchange's real-time benefit/formulary check.
 *
 * Weno offers self-serve sandbox access (unlike Surescripts RTPB, DrFirst,
 * CoverMyMeds, etc. which require enterprise contracts), so this is the
 * most realistic "live third-party API" path for a self-hosted project.
 * You still need to sign up at https://wenoexchange.com yourself, agree to
 * their terms, and get sandbox/production credentials — this file cannot
 * do that for you. Once you have credentials, set WENO_API_BASE_URL and
 * WENO_API_KEY in your .env and fill in the request/response mapping
 * below to match Weno's actual API contract (check their current API
 * docs — field names below are placeholders).
 *
 * Until configured, `enabled` is false and this provider is skipped, so
 * the app falls back to whatever local FormularyEntry data exists
 * (manual entry or CMS import).
 */
export class WenoFormularyProvider implements LiveFormularyProvider {
  readonly id = "WENO" as const;

  private readonly baseUrl = process.env.WENO_API_BASE_URL;
  private readonly apiKey = process.env.WENO_API_KEY;

  get enabled(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async checkCoverage(input: {
    plan: import("../../db/schema.js").InsurancePlan;
    medication: import("../../db/schema.js").Medication;
  }): Promise<CoverageResult | null> {
    if (!this.enabled) return null;

    // NOTE: this request shape is a placeholder. Replace with Weno's actual
    // eligibility/benefit-check endpoint and payload once you have their
    // current API reference in hand.
    const res = await fetch(`${this.baseUrl}/v1/benefit-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        ndc: input.medication.ndc,
        drug_name: input.medication.name,
        payer_name: input.plan.payerName,
        plan_name: input.plan.planName,
      }),
    });

    if (!res.ok) {
      // Don't throw — a failed live check should degrade to "unknown",
      // not break the whole coverage-check request.
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;

    return {
      covered: Boolean(data.covered),
      tier: "UNKNOWN",
      priorAuthRequired: Boolean(data.prior_auth_required),
      stepTherapyRequired: Boolean(data.step_therapy_required),
      quantityLimit: (data.quantity_limit as string) ?? null,
      estimatedCopayCents: (data.copay_cents as number) ?? null,
      estimatedCoinsurancePct: (data.coinsurance_pct as number) ?? null,
      notes: "Live result from Weno Exchange.",
      source: "WENO",
      sourceUpdatedAt: new Date(),
    };
  }
}
