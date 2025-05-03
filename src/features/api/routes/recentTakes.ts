import { eq, desc } from "drizzle-orm";
import { db } from "../../../libs/db";
import { takes as takesTable, users as usersTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { userService } from "../../../libs/cachet";

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
	userName?: string; // Add userName field
};

// Recent takes cache to reduce database queries
const takesCache = new Map<string, { data: RecentTake[]; timestamp: number }>();
const TAKES_CACHE_TTL = 30 * 1000; // 30 seconds cache TTL - shorter since takes change frequently

export async function recentTakes(url: URL): Promise<Response> {
	try {
		const userId = url.searchParams.get("user");

		// Check cache before querying database
		const cacheKey = userId || "all_takes";
		const cached = takesCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < TAKES_CACHE_TTL) {
			return new Response(
				JSON.stringify({
					takes: cached.data,
				}),
				{
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}

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

		// Use a JOIN query to get takes and user data in a single operation
		const takesWithUserData = await db
			.select({
				take: {
					id: takesTable.id,
					userId: takesTable.userId,
					notes: takesTable.notes,
					createdAt: takesTable.createdAt,
					media: takesTable.media,
					elapsedTime: takesTable.elapsedTime,
				},
				user: {
					projectName: usersTable.projectName,
					totalTakesTime: usersTable.totalTakesTime,
				},
			})
			.from(takesTable)
			.leftJoin(usersTable, eq(takesTable.userId, usersTable.id))
			.where(userId ? eq(takesTable.userId, userId) : undefined)
			.orderBy(desc(takesTable.createdAt))
			.limit(40);

		if (takesWithUserData.length === 0) {
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
		const userIds = [
			...new Set(takesWithUserData.map((item) => item.take.userId)),
		];

		// Fetch all user names from shared user service
		const userNamesPromises = userIds.map((id) =>
			userService.getUserName(id),
		);
		const userNames = await Promise.all(userNamesPromises);

		// Create a map of user names
		const userNameMap: Record<string, string> = {};
		userIds.forEach((id, index) => {
			userNameMap[id] = userNames[index] || "unknown";
		});

		// Map the joined results to the expected format
		const takes: RecentTake[] = takesWithUserData.map((item) => ({
			id: item.take.id,
			userId: item.take.userId,
			notes: item.take.notes,
			createdAt: new Date(item.take.createdAt),
			mediaUrls: item.take.media ? JSON.parse(item.take.media) : [],
			elapsedTime: item.take.elapsedTime,
			project: item.user?.projectName || "unknown project",
			totalTakesTime: item.user?.totalTakesTime || item.take.elapsedTime,
			userName: userNameMap[item.take.userId] || "Unknown User",
		}));

		// Store results in cache
		takesCache.set(cacheKey, {
			data: takes,
			timestamp: Date.now(),
		});

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
