import { eq, desc, and, or } from "drizzle-orm";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";

export type RecentTake = {
	id: string;
	userId: string;
	notes: string;
	createdAt: Date;
	mediaUrls: string[];
	elapsedTimeMs: number;
};

export async function recentTakes(url: URL): Promise<Response> {
	try {
		const userId = url.searchParams.get("user");

		const query = db
			.select()
			.from(takesTable)
			.orderBy(desc(takesTable.createdAt))
			.where(eq(takesTable.userId, userId ? userId : takesTable.userId))
			.limit(40);

		const recentTakes = await query;

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

		const takes: RecentTake[] =
			recentTakes.map((take) => ({
				id: take.id,
				userId: take.userId,
				notes: take.notes,
				createdAt: new Date(take.createdAt),
				mediaUrls: take.media ? JSON.parse(take.media) : [],
				elapsedTimeMs: take.elapsedTimeMs,
			})) || [];

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
	} catch (error) {
		return handleApiError(error, "recentTakes");
	}
}
