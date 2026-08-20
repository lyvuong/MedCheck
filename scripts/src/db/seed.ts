/**
 * Seeds realistic sample data so the app is usable immediately, without
 * waiting on a CMS import. Structured the same way real imported data
 * would be (same fields), so swapping in real data later is additive,
 * not a rebuild.
 *
 * User accounts aren't seeded here — auth is Google Sign-In only, and
 * roles are assigned by creating a `users/{email}` doc by hand in the
 * Firebase console (or via the app's Admin > Users panel once you're
 * signed in as the owner).
 *
 * Run with: npm run seed
 */
import { findPlanByExactName, createManualPlan } from "./repositories/insurancePlans.js";
import { createManualMedication } from "./repositories/medications.js";
import { upsertEntry } from "./repositories/formularyEntries.js";
import type { CoverageTier, InsurancePlan, Medication } from "./collections.js";

async function main() {
  console.log("Seeding insurance plans...");
  const planDefs = [
    { payerName: "Aetna", planName: "Aetna Better Health PPO", planType: "PPO", state: "NY" },
    { payerName: "Humana", planName: "Humana Gold Plus HMO", planType: "Medicare Advantage", state: "FL" },
    { payerName: "UnitedHealthcare", planName: "UHC Choice Plus", planType: "Employer PPO", state: "NY" },
    { payerName: "Cigna", planName: "Cigna Connect Marketplace", planType: "ACA Marketplace", state: "NJ" },
    { payerName: "Blue Cross Blue Shield", planName: "BCBS HMO Basic", planType: "HMO", state: "NY" },
  ];
  const planRecords: InsurancePlan[] = [];
  for (const p of planDefs) {
    const existing = await findPlanByExactName(p.planName);
    if (existing) {
      planRecords.push(existing);
      continue;
    }
    planRecords.push(await createManualPlan(p));
  }

  console.log("Seeding medications...");
  const medicationDefs = [
    // Statins
    { name: "Atorvastatin", genericName: "atorvastatin", drugClass: "Statin", strength: "20mg", form: "tablet" },
    { name: "Rosuvastatin (Crestor)", genericName: "rosuvastatin", drugClass: "Statin", strength: "10mg", form: "tablet" },
    { name: "Simvastatin", genericName: "simvastatin", drugClass: "Statin", strength: "40mg", form: "tablet" },
    // ACE inhibitors / ARBs
    { name: "Lisinopril", genericName: "lisinopril", drugClass: "ACE Inhibitor", strength: "10mg", form: "tablet" },
    { name: "Losartan", genericName: "losartan", drugClass: "ARB", strength: "50mg", form: "tablet" },
    // Diabetes
    { name: "Metformin", genericName: "metformin", drugClass: "Biguanide (Diabetes)", strength: "500mg", form: "tablet" },
    { name: "Jardiance", genericName: "empagliflozin", drugClass: "SGLT2 Inhibitor (Diabetes)", strength: "10mg", form: "tablet" },
    { name: "Ozempic", genericName: "semaglutide", drugClass: "GLP-1 Agonist (Diabetes)", strength: "0.5mg", form: "injection" },
    // SSRIs
    { name: "Sertraline (Zoloft)", genericName: "sertraline", drugClass: "SSRI", strength: "50mg", form: "tablet" },
    { name: "Escitalopram (Lexapro)", genericName: "escitalopram", drugClass: "SSRI", strength: "10mg", form: "tablet" },
    // Anticoagulants
    { name: "Eliquis", genericName: "apixaban", drugClass: "Anticoagulant", strength: "5mg", form: "tablet" },
    { name: "Warfarin", genericName: "warfarin", drugClass: "Anticoagulant", strength: "5mg", form: "tablet" },
  ];
  const medRecords: Medication[] = [];
  for (const m of medicationDefs) {
    const ndc = `SAMPLE-${m.genericName}`;
    medRecords.push(await createManualMedication({ ...m, ndc }));
  }

  console.log("Seeding formulary entries...");
  const byGeneric = (n: string) => medRecords.find((m) => m.genericName === n)!;

  type Rule = {
    drug: string;
    tier: CoverageTier;
    covered: boolean;
    pa?: boolean;
    step?: boolean;
    copay?: number;
    coins?: number;
    qty?: string;
  };

  // A small, varied set of coverage rules per plan so the demo shows real
  // differences (tiers, PA, step therapy, non-coverage, alternatives).
  const rules: Record<string, Rule[]> = {
    "Aetna Better Health PPO": [
      { drug: "atorvastatin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "rosuvastatin", tier: "TIER_3_PREFERRED_BRAND", covered: true, copay: 4000 },
      { drug: "lisinopril", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "metformin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "semaglutide", tier: "TIER_4_NON_PREFERRED_DRUG", covered: true, pa: true, copay: 9000 },
      { drug: "sertraline", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "apixaban", tier: "TIER_3_PREFERRED_BRAND", covered: true, pa: true, copay: 6000 },
    ],
    "Humana Gold Plus HMO": [
      { drug: "atorvastatin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 0 },
      { drug: "rosuvastatin", tier: "TIER_4_NON_PREFERRED_DRUG", covered: true, step: true, copay: 4500 },
      { drug: "lisinopril", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 0 },
      { drug: "empagliflozin", tier: "TIER_3_PREFERRED_BRAND", covered: true, pa: true, copay: 4700 },
      { drug: "semaglutide", tier: "NOT_COVERED", covered: false },
      { drug: "escitalopram", tier: "TIER_2_GENERIC", covered: true, copay: 1000 },
      { drug: "warfarin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 0 },
    ],
    "UHC Choice Plus": [
      { drug: "atorvastatin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 1000 },
      { drug: "simvastatin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 1000 },
      { drug: "losartan", tier: "TIER_2_GENERIC", covered: true, copay: 2000 },
      { drug: "metformin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 1000 },
      { drug: "empagliflozin", tier: "TIER_3_PREFERRED_BRAND", covered: true, pa: true, copay: 5000 },
      { drug: "apixaban", tier: "TIER_3_PREFERRED_BRAND", covered: true, copay: 5500, qty: "60 tablets / 30 days" },
    ],
    "Cigna Connect Marketplace": [
      { drug: "atorvastatin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, coins: 10 },
      { drug: "lisinopril", tier: "TIER_1_PREFERRED_GENERIC", covered: true, coins: 10 },
      { drug: "sertraline", tier: "TIER_1_PREFERRED_GENERIC", covered: true, coins: 10 },
      { drug: "escitalopram", tier: "TIER_3_PREFERRED_BRAND", covered: true, coins: 30, step: true },
      { drug: "semaglutide", tier: "TIER_5_SPECIALTY", covered: true, pa: true, coins: 40 },
    ],
    "BCBS HMO Basic": [
      { drug: "atorvastatin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "metformin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "warfarin", tier: "TIER_1_PREFERRED_GENERIC", covered: true, copay: 500 },
      { drug: "apixaban", tier: "NOT_COVERED", covered: false },
      { drug: "rosuvastatin", tier: "TIER_3_PREFERRED_BRAND", covered: true, pa: true, copay: 3500 },
    ],
  };

  for (const plan of planRecords) {
    const planRules = rules[plan.planName] ?? [];
    for (const r of planRules) {
      const med = byGeneric(r.drug);
      if (!med) continue;
      await upsertEntry({
        planId: plan.id,
        medicationId: med.id,
        tier: r.tier,
        covered: r.covered,
        priorAuthRequired: !!r.pa,
        stepTherapyRequired: !!r.step,
        quantityLimit: r.qty,
        estimatedCopayCents: r.copay,
        estimatedCoinsurancePct: r.coins,
        dataSource: "MANUAL",
        sourceUpdatedAt: new Date(),
      });
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
