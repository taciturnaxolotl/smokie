import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Define the takes table
export const takes = sqliteTable("takes", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	ts: text("ts"),
	status: text("status").notNull().default("active"), // active, paused, waitingUpload, completed
	elapsedTimeMs: integer("elapsed_time_ms").notNull().default(0),
	targetDurationMs: integer("target_duration_ms").notNull(),
	periods: text("periods").notNull(), // JSON string of time periods
	lastResumeAt: integer("last_resume_at", { mode: "timestamp" }),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
	completedAt: integer("completed_at", { mode: "timestamp" }),
	takeUploadedAt: integer("take_uploaded_at", { mode: "timestamp" }),
	takeUrl: text("take_url"),
	multiplier: text("multiplier").notNull().default("1.0"),
	notes: text("notes"),
	description: text("description"),
	notifiedLowTime: integer("notified_low_time", { mode: "boolean" }).default(
		false,
	), // has user been notified about low time
	notifiedPauseExpiration: integer("notified_pause_expiration", {
		mode: "boolean",
	}).default(false), // has user been notified about pause expiration
});
