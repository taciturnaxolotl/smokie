import { eq, desc, or } from "drizzle-orm";
import { db } from "../../../libs/db";
import { takes as takesTable, users as usersTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";

export type RecentTake = {
	id: string;
	userId: string;
	notes: string;
	createdAt: Date;
	mediaUrls: string[];
	/* elapsed time in seconds */
	elapsedTime: number;
	project: string;
	/* total time in seconds */
	totalTakesTime: number;
};

export async function recentTakes(url: URL): Promise<Response> {
	try {
		const userId = url.searchParams.get("user");

		if (userId) {
			// Verify user exists if userId provided
			const user = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.id, userId))
				.limit(1);

			if (user.length === 0) {
				return new Response(
					JSON.stringify({
						error: "User not found",
						takes: [],
					}),
					{
						status: 404,
						headers: {
							"Content-Type": "application/json",
						},
					},
				);
			}
		}

		const recentTakes = await db
			.select()
			.from(takesTable)
			.orderBy(desc(takesTable.createdAt))
			.where(eq(takesTable.userId, userId ? userId : takesTable.userId))
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

		// Get unique user IDs
		const userIds = [...new Set(recentTakes.map((take) => take.userId))];

		// Query users from takes table
		const users = await db
			.select()
			.from(usersTable)
			.where(or(...userIds.map((id) => eq(usersTable.id, id))));

		// Create map of user data by ID
		const userMap = users.reduce(
			(acc, user) => {
				acc[user.id] = user;
				return acc;
			},
			{} as Record<string, (typeof users)[number]>,
		);

		const takes: RecentTake[] =
			recentTakes.map((take) => ({
				id: take.id,
				userId: take.userId,
				notes: take.notes,
				createdAt: new Date(take.createdAt),
				mediaUrls: take.media ? JSON.parse(take.media) : [],
				elapsedTime: take.elapsedTime,
				project: userMap[take.userId]?.projectName || "unknown project",
				totalTakesTime:
					userMap[take.userId]?.totalTakesTime || take.elapsedTime,
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
