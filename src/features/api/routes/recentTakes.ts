import { eq, desc } from "drizzle-orm";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";

export default async function recentTakes(): Promise<Response> {
	const recentTakes = await db
		.select()
		.from(takesTable)
		.where(eq(takesTable.status, "approved"))
		.orderBy(desc(takesTable.completedAt))
		.limit(40);

	if (recentTakes.length === 0) {
		return new Response(
			JSON.stringify({
				takes: [],
			}),
			{
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	}

	const takes = recentTakes.map((take) => ({
		id: take.id,
		userId: take.userId,
		description: take.description,
		completedAt: take.completedAt,
		status: take.status,
		mp4Url: take.takeUrl,
		elapsedTime: take.elapsedTimeMs,
	}));

	return new Response(
		JSON.stringify({
			takes,
		}),
		{
			headers: {
				"Content-Type": "application/json",
			},
		},
	);
}
