import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
 id: text("id").primaryKey(), referenceCode: text("reference_code").notNull(), submissionKey: text("submission_key").notNull(),
 category: text("category").notNull(), subject: text("subject").notNull(), message: text("message").notNull(), priority: text("priority").notNull(), location: text("location"),
 status: text("status").notNull().default("New"), flags: text("flags").notNull().default("[]"), publicUpdate: text("public_update").notNull().default(""), lastMutation: text("last_mutation"),
 createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(), resolvedAt: text("resolved_at"), archivedAt: text("archived_at"), version: integer("version").notNull().default(0)
}, t => [uniqueIndex("idx_submissions_reference").on(t.referenceCode), uniqueIndex("idx_submissions_retry").on(t.submissionKey), index("idx_submissions_status_created").on(t.archivedAt,t.status,t.createdAt), index("idx_submissions_updated").on(t.updatedAt)]);
export const notes = sqliteTable("internal_notes", {id: text("id").primaryKey(), submissionId: text("submission_id").notNull().references(()=>submissions.id), body: text("body").notNull(), actor: text("actor").notNull(), createdAt: text("created_at").notNull()},t=>[index("idx_notes_submission").on(t.submissionId)]);
export const history = sqliteTable("history", {id: text("id").primaryKey(), submissionId: text("submission_id").notNull().references(()=>submissions.id), event: text("event").notNull(), actor: text("actor"), createdAt: text("created_at").notNull()},t=>[index("idx_history_submission").on(t.submissionId),index("idx_history_created").on(t.createdAt)]);
export const rateLimits = sqliteTable("rate_limits", {key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull()},t=>[index("idx_rate_expiry").on(t.expiresAt)]);
