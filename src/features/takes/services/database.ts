import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq, and, desc, not } from "drizzle-orm";

export async function getActiveTake(userId: string) {
	return db
		.select()
		.from(takesTable)
		.where(
			and(eq(takesTable.userId, userId), eq(takesTable.status, "active")),
		)
		.limit(1);
}

export async function getPausedTake(userId: string) {
	return db
		.select()
		.from(takesTable)
		.where(
			and(eq(takesTable.userId, userId), eq(takesTable.status, "paused")),
		)
		.limit(1);
}

export async function getCompletedTakes(userId: string, limit = 5) {
	return db
		.select()
		.from(takesTable)
		.where(
			and(
				eq(takesTable.userId, userId),
				and(
					not(eq(takesTable.status, "active")),
					not(eq(takesTable.status, "paused")),
				),
			),
		)
		.orderBy(desc(takesTable.completedAt))
		.limit(limit);
}
