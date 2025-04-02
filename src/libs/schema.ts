import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Define the takes table
export const takes = sqliteTable("takes", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	ts: text("ts"),
	status: text("status").notNull().default("active"), // active, paused, waitingUpload, completed
	startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
	pausedAt: integer("paused_at", { mode: "timestamp" }),
	completedAt: integer("completed_at", { mode: "timestamp" }),
	takeUploadedAt: integer("take_uploaded_at", { mode: "timestamp" }),
	takeUrl: text("take_url"),
	takeThumbUrl: text("take_thumb_url"),
	multiplier: text("multiplier").notNull().default("1.0"),
	durationMinutes: integer("duration_minutes").notNull().default(5), // 5 minutes for testing (should be 90)
	pausedTimeMs: integer("paused_time_ms").notNull().default(0), // cumulative paused time
	notes: text("notes"),
	description: text("description"),
	notifiedLowTime: integer("notified_low_time", { mode: "boolean" }).default(
		false,
	), // has user been notified about low time
	notifiedPauseExpiration: integer("notified_pause_expiration", {
		mode: "boolean",
	}).default(false), // has user been notified about pause expiration
});
