/**
 * Bulk-imports CMS Part D Formulary/Pharmacy Network/Pricing PUF files
 * into Firestore. Run after downloading and unzipping the files from CMS
 * (see columnMapping.ts for where, and how to adjust column names if your
 * download's headers differ).
 *
 * The Basic Drugs Formulary file has no plan identifier of its own —
 * plans and formularies link only through FORMULARY_ID, and one
 * formulary is commonly shared by several plans. This CLI reads the
 * plan file first to build that link (and to filter down to the state/
 * payers you actually want) entirely in memory, before making any
 * Firestore calls, then walks the formulary file once, writing an entry
 * for every (plan, drug) pair implied by the filtered plans.
 *
 * These files cover the whole country and can be 100K+ plan rows /
 * 1M+ formulary rows — importing that unfiltered would blow past
 * Firestore's free-tier storage (1 GiB) and take over a month against
 * the 20K-writes/day cap. Filtering with --state and/or --payersFile
 * first is strongly recommended, not just a nice-to-have.
 *
 * Usage:
 *   npm run import:cms -- --plans path/to/plan_information.txt --formulary path/to/basic_drugs_formulary.txt \
 *     --year 2026 --state MD --payersFile path/to/payers.txt [--maxWrites 18000]
 *
 * --payersFile: a plain text file, one CONTRACT_NAME per line, exactly
 * as it appears in the plan file (case-insensitive). Insurers file under
 * their legal underwriting entity, not their brand name, and that name
 * often differs by state (e.g. Blue Cross Blue Shield's Maryland
 * licensee is "CAREFIRST ADVANTAGE ..."), so inspect your plan file's
 * CONTRACT_NAME column for your target state before writing this list —
 * don't guess.
 */
import { createReadStream, readFileSync, existsSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse";
import { upsertCmsPlan } from "../../db/repositories/insurancePlans.js";
import { upsertCmsMedication } from "../../db/repositories/medications.js";
import { upsertEntry } from "../../db/repositories/formularyEntries.js";
import { PLAN_FILE_COLUMNS, FORMULARY_FILE_COLUMNS, mapTier, yn } from "./columnMapping.js";

// Firestore's free Spark plan hard-caps writes at 20,000/day (writes are
// simply rejected past this — there's no overage since billing isn't
// enabled). Default leaves headroom for the rest of the app's normal
// traffic that day.
const DEFAULT_MAX_WRITES = 18000;

// Multi-day imports need to pick up where the previous day's run stopped —
// otherwise every run re-reads the formulary file from row 1 and wastes its
// whole write budget re-upserting the same rows. Keyed on the formulary
// file path so a different import job (different file) doesn't inherit a
// stale offset.
const CHECKPOINT_PATH = "cms-import-checkpoint.json";

interface Checkpoint {
  formularyFile: string;
  rowsProcessed: number;
}

function loadCheckpoint(formularyFile: string): number {
  if (!existsSync(CHECKPOINT_PATH)) return 0;
  try {
    const data = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8")) as Checkpoint;
    return data.formularyFile === formularyFile ? data.rowsProcessed : 0;
  } catch {
    return 0;
  }
}

function saveCheckpoint(formularyFile: string, rowsProcessed: number) {
  const data: Checkpoint = { formularyFile, rowsProcessed };
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(data, null, 2));
}

/** Retries a single Firestore write a few times with backoff before
 * giving up — a transient network blip (e.g. the machine briefly losing
 * connectivity) shouldn't crash a run that's already 10,000+ writes in. */
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`  ${label} failed (attempt ${attempt}/${attempts}): ${message}`);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
  }
  throw lastErr;
}

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

/** These files are pipe (`|`) -delimited `.txt`, not comma-separated
 * CSV, despite how CMS's docs sometimes describe them — detected from
 * the header line rather than assumed, so a genuine CSV still works. */
function detectDelimiter(path: string): string {
  const sample = readFileSync(path, "utf8").slice(0, 8192);
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestCount = -1;
  for (const candidate of [",", "|", "\t", ";"]) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

async function readDelimited(path: string): Promise<Record<string, string>[]> {
  const delimiter = detectDelimiter(path);
  console.log(`  detected delimiter ${JSON.stringify(delimiter)} for ${path}`);
  const rows: Record<string, string>[] = [];
  const parser = createReadStream(path).pipe(
    parse({ columns: true, skip_empty_lines: true, trim: true, delimiter })
  );
  for await (const record of parser) {
    rows.push(record as Record<string, string>);
  }
  return rows;
}

function readPayersFile(path: string): Set<string> {
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.toUpperCase())
  );
}

interface PlanRow {
  contractId: string;
  planId: string;
  segmentId: string;
  planName: string;
  payerName: string;
  state: string | null;
}

async function main() {
  const args = parseArgs();
  if (!args.plans || !args.formulary) {
    console.error(
      "Usage: npm run import:cms -- --plans <plan_information.txt> --formulary <basic_drugs_formulary.txt> " +
        "[--year 2026] [--state MD] [--payersFile payers.txt] [--maxWrites 18000]"
    );
    process.exit(1);
  }
  const year = args.year ? Number(args.year) : new Date().getFullYear();
  const maxWrites = args.maxWrites ? Number(args.maxWrites) : DEFAULT_MAX_WRITES;
  const stateFilter = args.state?.toUpperCase();
  const payersFilter = args.payersFile ? readPayersFile(args.payersFile) : null;
  let writeCount = 0;
  let budgetExceeded = false;

  console.log(`Reading plan file: ${args.plans}`);
  const planRows = await readDelimited(args.plans);
  console.log(`  ${planRows.length} plan rows`);

  // Pass 1 (in memory, no Firestore calls yet): dedupe plans by
  // (contractId, planId, segmentId) — the file has one row per
  // plan-per-county, so most rows collapse — while filtering to the
  // requested state/payers, and record which plans each FORMULARY_ID
  // applies to.
  const uniquePlans = new Map<string, PlanRow>();
  const formularyToPlanKeys = new Map<string, Set<string>>();

  for (const row of planRows) {
    const contractId = row[PLAN_FILE_COLUMNS.contractId];
    const planId = row[PLAN_FILE_COLUMNS.planId];
    const segmentId = row[PLAN_FILE_COLUMNS.segmentId] || "0";
    const formularyId = row[PLAN_FILE_COLUMNS.formularyId];
    const state = row[PLAN_FILE_COLUMNS.state] || null;
    const payerName = row[PLAN_FILE_COLUMNS.payerName] ?? "Unknown payer";
    if (!contractId || !planId || !formularyId) continue;
    if (stateFilter && state?.toUpperCase() !== stateFilter) continue;
    if (payersFilter && !payersFilter.has(payerName.toUpperCase())) continue;

    const planKey = `${contractId}|${planId}|${segmentId}`;
    if (!uniquePlans.has(planKey)) {
      uniquePlans.set(planKey, {
        contractId,
        planId,
        segmentId,
        planName: row[PLAN_FILE_COLUMNS.planName] ?? "Unknown plan",
        payerName,
        state,
      });
    }
    if (!formularyToPlanKeys.has(formularyId)) formularyToPlanKeys.set(formularyId, new Set());
    formularyToPlanKeys.get(formularyId)!.add(planKey);
  }
  console.log(
    `  ${uniquePlans.size} unique plans after filtering, referencing ${formularyToPlanKeys.size} formularies`
  );
  if (uniquePlans.size === 0) {
    console.log("No plans matched --state/--payersFile — nothing to import. Check your filter values against the plan file's actual STATE/CONTRACT_NAME columns.");
    process.exit(0);
  }

  console.log("Upserting plans...");
  const planKeyToId = new Map<string, string>();
  for (const [planKey, p] of uniquePlans) {
    if (writeCount >= maxWrites) {
      budgetExceeded = true;
      break;
    }
    const plan = await withRetry(
      () =>
        upsertCmsPlan({
          contractId: p.contractId,
          planId: p.planId,
          segmentId: p.segmentId,
          planYear: year,
          planName: p.planName,
          payerName: p.payerName,
          planType: null,
          state: p.state,
        }),
      `plan upsert (${p.payerName} / ${p.planName})`
    );
    writeCount++;
    planKeyToId.set(planKey, plan.id);
  }
  console.log(`  upserted ${planKeyToId.size} plans, ${writeCount} writes used so far`);

  if (!budgetExceeded) {
    console.log(`Reading formulary file: ${args.formulary}`);
    const formularyRows = await readDelimited(args.formulary);
    console.log(`  ${formularyRows.length} formulary rows`);

    const relevantFormularyIds = new Set(formularyToPlanKeys.keys());
    const upsertedNdcsThisRun = new Set<string>();
    let medsUpserted = 0;
    let entriesUpserted = 0;
    let rowsProcessed = 0;
    let skippedIrrelevant = 0;

    const skipRows = loadCheckpoint(args.formulary);
    if (skipRows > 0) {
      console.log(`  resuming from row ${skipRows} (checkpoint from a previous run)`);
    }

    // lastCompletedIndex only advances past a row once every write it
    // implies (the medication upsert plus one entry per plan sharing its
    // formulary) has actually succeeded — so if the write budget runs out
    // mid-row, that row is re-attempted in full next run rather than
    // silently leaving some plans' entries missing forever. The extra
    // idempotent re-writes this costs at the boundary are a few writes,
    // not a real problem.
    let lastCompletedIndex = skipRows - 1;

    if (skipRows >= formularyRows.length) {
      console.log("  checkpoint shows this formulary file is already fully processed — nothing left to do.");
    } else {
      outer: for (let i = skipRows; i < formularyRows.length; i++) {
        const row = formularyRows[i];
        const formularyId = row[FORMULARY_FILE_COLUMNS.formularyId];
        const ndc = row[FORMULARY_FILE_COLUMNS.ndc];
        rowsProcessed++;
        if (!formularyId || !ndc || !relevantFormularyIds.has(formularyId)) {
          skippedIrrelevant++;
          lastCompletedIndex = i;
          continue;
        }

        if (writeCount >= maxWrites) {
          budgetExceeded = true;
          break outer;
        }

        // Medication doc ID is always the NDC itself, so no read is
        // needed to know medicationId even when we skip the write below.
        const medicationId = ndc;
        if (!upsertedNdcsThisRun.has(ndc)) {
          await withRetry(
            () =>
              upsertCmsMedication({
                ndc,
                rxcui: row[FORMULARY_FILE_COLUMNS.rxcui] || undefined,
                // CMS formulary files identify drugs by NDC/RXCUI, not name;
                // cross-reference against an RxNorm/NDC directory to backfill
                // real drug names if you want nicer display text.
                name: `NDC ${ndc}`,
              }),
            `medication upsert (NDC ${ndc})`
          );
          writeCount++;
          upsertedNdcsThisRun.add(ndc);
          medsUpserted++;
        }

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
        const tier = mapTier(row[FORMULARY_FILE_COLUMNS.tierLevel]);
        const priorAuthRequired = yn(row[FORMULARY_FILE_COLUMNS.priorAuthFlag]);
        const stepTherapyRequired = yn(row[FORMULARY_FILE_COLUMNS.stepTherapyFlag]);

        // One formulary commonly applies to several plans — write an
        // entry for each.
        let rowFullyDone = true;
        for (const planKey of formularyToPlanKeys.get(formularyId)!) {
          if (writeCount >= maxWrites) {
            budgetExceeded = true;
            rowFullyDone = false;
            break outer;
          }
          const dbPlanId = planKeyToId.get(planKey);
          if (!dbPlanId) continue; // plan upsert didn't reach this one before the budget ran out
          await withRetry(
            () =>
              upsertEntry({
                planId: dbPlanId,
                medicationId,
                tier,
                covered: true,
                priorAuthRequired,
                stepTherapyRequired,
                quantityLimit,
                dataSource: "CMS_PUF",
                sourceUpdatedAt: new Date(),
              }),
            `formulary entry upsert (plan ${dbPlanId} / NDC ${ndc})`
          );
          writeCount++;
          entriesUpserted++;
          if (writeCount % 1000 === 0) {
            console.log(`  ...${writeCount} writes so far (${medsUpserted} meds, ${entriesUpserted} entries)`);
          }
        }
        if (rowFullyDone) lastCompletedIndex = i;
      }
    }

    const newCheckpoint = lastCompletedIndex + 1;
    saveCheckpoint(args.formulary, newCheckpoint);

    console.log(
      `Done. ${medsUpserted} medications upserted, ${entriesUpserted} formulary entries upserted, ` +
        `${rowsProcessed} formulary rows processed (${skippedIrrelevant} skipped as irrelevant), ${writeCount} Firestore writes used.`
    );
    if (newCheckpoint >= formularyRows.length) {
      console.log("  reached the end of the formulary file — this import is fully complete.");
    } else {
      console.log(`  checkpoint saved at row ${newCheckpoint} of ${formularyRows.length}.`);
    }
  }

  if (budgetExceeded) {
    console.log(
      `\nStopped at the ${maxWrites}-write budget for today (Firestore Spark plan caps at 20,000 writes/day). ` +
        `Re-run the exact same command tomorrow (or after your quota resets) to continue from the saved checkpoint.`
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
