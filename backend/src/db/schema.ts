import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "DOCTOR", "STAFF"]);

// Where a given plan's / formulary entry's data came from.
export const dataSourceEnum = pgEnum("data_source_type", ["MANUAL", "CMS_PUF", "WENO"]);

export const coverageTierEnum = pgEnum("coverage_tier", [
  "TIER_1_PREFERRED_GENERIC",
  "TIER_2_GENERIC",
  "TIER_3_PREFERRED_BRAND",
  "TIER_4_NON_PREFERRED_DRUG",
  "TIER_5_SPECIALTY",
  "NOT_COVERED",
  "UNKNOWN",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("STAFF"),
  npi: text("npi"), // National Provider Identifier, optional, doctors only
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insurancePlans = pgTable(
  "insurance_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payerName: text("payer_name").notNull(), // e.g. "Aetna", "Humana"
    planName: text("plan_name").notNull(), // e.g. "Humana Gold Plus HMO"
    planType: text("plan_type"), // HMO, PPO, Medicare Advantage, Marketplace, Employer...
    contractId: text("contract_id"), // CMS contract ID, when sourced from CMS PUF
    planId: text("plan_id"), // CMS plan ID, when sourced from CMS PUF
    segmentId: text("segment_id"),
    planYear: integer("plan_year"),
    state: text("state"),
    dataSource: dataSourceEnum("data_source").notNull().default("MANUAL"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cmsIdentity: uniqueIndex("uniq_cms_plan_identity").on(
      table.contractId,
      table.planId,
      table.segmentId,
      table.planYear
    ),
    payerPlanIdx: index("plan_payer_name_idx").on(table.payerName, table.planName),
  })
);

export const medications = pgTable(
  "medications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(), // brand or generic display name
    genericName: text("generic_name"),
    ndc: text("ndc").unique(), // National Drug Code, when known
    rxcui: text("rxcui"), // RxNorm concept ID
    drugClass: text("drug_class"), // therapeutic class, used to suggest alternatives
    strength: text("strength"),
    form: text("form"), // tablet, capsule, injection, etc.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: index("medication_name_idx").on(table.name),
    classIdx: index("medication_class_idx").on(table.drugClass),
  })
);

export const formularyEntries = pgTable(
  "formulary_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => insurancePlans.id, { onDelete: "cascade" }),
    medicationId: uuid("medication_id")
      .notNull()
      .references(() => medications.id, { onDelete: "cascade" }),

    tier: coverageTierEnum("tier").notNull().default("UNKNOWN"),
    covered: boolean("covered").notNull().default(true),
    priorAuthRequired: boolean("prior_auth_required").notNull().default(false),
    stepTherapyRequired: boolean("step_therapy_required").notNull().default(false),
    quantityLimit: text("quantity_limit"),
    estimatedCopayCents: integer("estimated_copay_cents"),
    estimatedCoinsurancePct: real("estimated_coinsurance_pct"),
    notes: text("notes"),

    dataSource: dataSourceEnum("data_source").notNull().default("MANUAL"),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqPlanMedication: uniqueIndex("uniq_plan_medication").on(table.planId, table.medicationId),
    medicationIdx: index("formulary_medication_idx").on(table.medicationId),
  })
);

export const lookupLogs = pgTable(
  "lookup_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    medicationQuery: text("medication_query").notNull(),
    planId: uuid("plan_id"),
    resultSummary: text("result_summary"), // short text snapshot of the result, for audit trail
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("lookup_user_created_idx").on(table.userId, table.createdAt),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type InsurancePlan = typeof insurancePlans.$inferSelect;
export type NewInsurancePlan = typeof insurancePlans.$inferInsert;
export type Medication = typeof medications.$inferSelect;
export type NewMedication = typeof medications.$inferInsert;
export type FormularyEntry = typeof formularyEntries.$inferSelect;
export type NewFormularyEntry = typeof formularyEntries.$inferInsert;
export type CoverageTier = (typeof coverageTierEnum.enumValues)[number];
