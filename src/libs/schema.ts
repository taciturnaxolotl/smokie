import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import type { Pool } from "pg";
import TakesConfig from "./config";

// Define the takes table
export const takes = pgTable("takes", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	ts: text("ts").notNull(),
	/* elapsed time in seconds */
	elapsedTime: integer("elapsed_time").notNull().default(0),
	createdAt: text("created_at")
		.$defaultFn(() => new Date().toISOString())
		.notNull(),
	media: text("media").notNull().default("[]"), // array of media urls
	multiplier: text("multiplier").notNull().default("1.0"),
	notes: text("notes").notNull().default(""),
});

export const users = pgTable("users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => Bun.randomUUIDv7()),
	/* total time in seconds */
	totalTakesTime: integer("total_takes_time").default(0).notNull(),
	hackatimeKeys: text("hackatime_keys").notNull().default("[]"),
	projectName: text("project_name").notNull().default(""),
	projectCategory: text("project_category").notNull().default("other"),
	projectDescription: text("project_description").notNull().default(""),
	projectBannerUrl: text("project_banner_url").notNull().default(""),
	hackatimeVersion: text("hackatime_version").notNull().default("v1"),
	lastTakeUploadDate: text("last_take_upload_date")
		.notNull()
		.default(TakesConfig.START_DATE.toISOString()),
	isUploading: boolean("is_uploading").default(false).notNull(),
	repoLink: text("repo_link"),
	demoLink: text("demo_link"),
	createdAt: text("created_at")
		.$defaultFn(() => new Date().toISOString())
		.notNull(),
});

export async function setupTriggers(pool: Pool) {
	await pool.query(`
		CREATE INDEX IF NOT EXISTS idx_takes_user_id ON takes(user_id);

		CREATE OR REPLACE FUNCTION update_user_total_time()
				RETURNS TRIGGER AS $$
				BEGIN
						IF TG_OP = 'INSERT' THEN
								UPDATE users
								SET total_takes_time = COALESCE(total_takes_time, 0) + NEW.elapsed_time,
												last_take_upload_date = NEW.created_at
								WHERE id = NEW.user_id;
								RETURN NEW;
						ELSIF TG_OP = 'DELETE' THEN
								UPDATE users
								SET total_takes_time = COALESCE(total_takes_time, 0) - OLD.elapsed_time
								WHERE id = OLD.user_id;
								RETURN OLD;
						ELSIF TG_OP = 'UPDATE' THEN
								UPDATE users
								SET total_takes_time = COALESCE(total_takes_time, 0) - OLD.elapsed_time + NEW.elapsed_time,
												last_take_upload_date = CASE WHEN NEW.created_at > OLD.created_at THEN NEW.created_at ELSE users.last_take_upload_date END
								WHERE id = NEW.user_id;
								RETURN NEW;
						END IF;

						RETURN NULL;  -- Default return for unexpected operations

						EXCEPTION WHEN OTHERS THEN
								RAISE NOTICE 'Error updating user total time: %', SQLERRM;
								RETURN NULL;
				END;
				$$ LANGUAGE plpgsql;

		DROP TRIGGER IF EXISTS update_user_total_time_trigger ON takes;

		CREATE TRIGGER update_user_total_time_trigger
		AFTER INSERT OR UPDATE OR DELETE ON takes
		FOR EACH ROW
		EXECUTE FUNCTION update_user_total_time();
	`);
}
