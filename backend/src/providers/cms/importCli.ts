/**
 * Bulk-imports CMS Part D Formulary/Pharmacy Network/Pricing PUF files
 * into Firestore. Run after downloading and unzipping the files from CMS
 * (see columnMapping.ts for where, and how to adjust column names if your
 * download's headers differ).
 *
 * Usage:
 *   npm run import:cms -- --plans path/to/plan_information.csv --formulary path/to/basic_drugs_formulary.csv --year 2026 [--maxWrites 18000]
 *
 * This is intentionally a standalone CLI rather than something triggered
 * from the web app: these files are multi-gigabyte and CMS's terms of use
 * require you to review/accept them yourself before downloading, so an
 * automated in-app "sync now" button isn't realistic here.
 */
import { createReadStream } from "node:fs";
import { parse } from "csv-parse";
import { upsertCmsPlan } from "../../db/repositories/insurancePlans.js";
import { upsertCmsMedication } from "../../db/repositories/medications.js";
import { upsertEntry } from "../../db/repositories/formularyEntries.js";
import { PLAN_FILE_COLUMNS, FORMULARY_FILE_COLUMNS, mapTier, yn } from "./columnMapping.js";

// Firestore's free Spark plan hard-caps writes at 20,000/day (writes are
// simply rejected past this — there's no overage since billing isn't
// enabled). Each formulary row costs up to 2 writes here (medication +
// formulary entry; plan writes are memoized per run), so this default
// leaves headroom for the rest of the app's normal traffic that day.
const DEFAULT_MAX_WRITES = 18000;

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      out[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return out;
}

async function readCsv(path: string): Promise<Record<string, string>[]> {
  const rows: Record<string, string>[] = [];
  const parser = createReadStream(path).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true })
  );
  for await (const record of parser) {
    rows.push(record as Record<string, string>);
  }
  return rows;
}

async function main() {
  const args = parseArgs();
  if (!args.plans || !args.formulary) {
    console.error(
      "Usage: npm run import:cms -- --plans <plan_information.csv> --formulary <formulary.csv> [--year 2026] [--maxWrites 18000]"
    );
    process.exit(1);
  }
  const year = args.year ? Number(args.year) : new Date().getFullYear();
  const maxWrites = args.maxWrites ? Number(args.maxWrites) : DEFAULT_MAX_WRITES;
  let writeCount = 0;

  console.log(`Reading plan file: ${args.plans}`);
  const planRows = await readCsv(args.plans);
  console.log(`  ${planRows.length} plan rows`);

  const planKeyToId = new Map<string, string>();
  let plansUpserted = 0;
  for (const row of planRows) {
    const contractId = row[PLAN_FILE_COLUMNS.contractId];
    const planIdRaw = row[PLAN_FILE_COLUMNS.planId];
    const segmentId = row[PLAN_FILE_COLUMNS.segmentId] || "0";
    if (!contractId || !planIdRaw) continue;

    const plan = await upsertCmsPlan({
      contractId,
      planId: planIdRaw,
      segmentId,
      planYear: year,
      planName: row[PLAN_FILE_COLUMNS.planName] ?? "Unknown plan",
      payerName: row[PLAN_FILE_COLUMNS.payerName] ?? "Unknown payer",
      planType: row[PLAN_FILE_COLUMNS.planType] ?? null,
      state: row[PLAN_FILE_COLUMNS.state] ?? null,
    });
    writeCount++;
    planKeyToId.set(`${contractId}|${planIdRaw}|${segmentId}`, plan.id);
    plansUpserted++;
  }
  console.log(`  upserted ${plansUpserted} plans`);

  console.log(`Reading formulary file: ${args.formulary}`);
  const formularyRows = await readCsv(args.formulary);
  console.log(`  ${formularyRows.length} formulary rows`);

  let medsUpserted = 0;
  let entriesUpserted = 0;
  let skippedNoPlan = 0;
  let rowsProcessed = 0;

  for (const row of formularyRows) {
    if (writeCount >= maxWrites) {
      console.log(
        `\nStopping at ${rowsProcessed}/${formularyRows.length} formulary rows — hit the ` +
          `${maxWrites}-write budget for today (Firestore Spark plan caps at 20,000 writes/day). ` +
          `Re-run the same command tomorrow (or after your quota resets) to continue; rows are ` +
          `upserted by a deterministic ID, so re-running from the start is safe.`
      );
      break;
    }

    const contractId = row[FORMULARY_FILE_COLUMNS.contractId];
    const planIdRaw = row[FORMULARY_FILE_COLUMNS.planId];
    const segmentId = row[FORMULARY_FILE_COLUMNS.segmentId] || "0";
    const ndc = row[FORMULARY_FILE_COLUMNS.ndc];
    rowsProcessed++;
    if (!contractId || !planIdRaw || !ndc) continue;

    const dbPlanId = planKeyToId.get(`${contractId}|${planIdRaw}|${segmentId}`);
    if (!dbPlanId) {
      skippedNoPlan++;
      continue;
    }

    const medication = await upsertCmsMedication({
      ndc,
      rxcui: row[FORMULARY_FILE_COLUMNS.rxcui] || undefined,
      // CMS formulary files identify drugs by NDC/RXCUI, not name;
      // cross-reference against an RxNorm/NDC directory to backfill real
      // drug names if you want nicer display text than the raw NDC.
      name: `NDC ${ndc}`,
    });
    writeCount++;
    medsUpserted++;

    const quantityLimit = yn(row[FORMULARY_FILE_COLUMNS.quantityLimitFlag])
      ? [
          row[FORMULARY_FILE_COLUMNS.quantityLimitAmount],
          row[FORMULARY_FILE_COLUMNS.quantityLimitDays]
            ? `per ${row[FORMULARY_FILE_COLUMNS.quantityLimitDays]} days`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

    await upsertEntry({
      planId: dbPlanId,
      medicationId: medication.id,
      tier: mapTier(row[FORMULARY_FILE_COLUMNS.tierLevel]),
      covered: true,
      priorAuthRequired: yn(row[FORMULARY_FILE_COLUMNS.priorAuthFlag]),
      stepTherapyRequired: yn(row[FORMULARY_FILE_COLUMNS.stepTherapyFlag]),
      quantityLimit,
      dataSource: "CMS_PUF",
      sourceUpdatedAt: new Date(),
    });
    writeCount++;
    entriesUpserted++;
  }

  console.log(
    `Done. ${medsUpserted} medications upserted, ${entriesUpserted} formulary entries upserted, ` +
      `${skippedNoPlan} rows skipped (no matching plan), ${writeCount} Firestore writes used.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
