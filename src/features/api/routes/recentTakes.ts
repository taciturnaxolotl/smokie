import { eq, desc, or } from "drizzle-orm";
import { db } from "../../../libs/db";
import { takes as takesTable, users as usersTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { fetchUserData } from "../../../libs/cachet";

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

// Cache for user data from cachet
const userCache: Record<string, { name: string; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Track pending requests to avoid duplicate API calls
const pendingRequests: Record<string, Promise<string>> = {};

// Function to get user name from cache or fetch it
async function getUserName(userId: string): Promise<string> {
	const now = Date.now();

	// Check if user data is in cache and still valid
	if (userCache[userId] && now - userCache[userId].timestamp < CACHE_TTL) {
		return userCache[userId].name;
	}

	// If there's already a pending request for this user, return that promise
	// instead of creating a new request
	if (pendingRequests[userId]) {
		return pendingRequests[userId];
	}

	// Create a new promise for this user and store it
	const fetchPromise = (async () => {
		try {
			const userData = await fetchUserData(userId);
			const userName = userData?.displayName || "Unknown User";

			userCache[userId] = {
				name: userName,
				timestamp: now,
			};

			return userName;
		} catch (error) {
			console.error("Error fetching user data:", error);
			return "Unknown User";
		} finally {
			// Clean up the pending request when done
			delete pendingRequests[userId];
		}
	})();

	// Store the promise
	pendingRequests[userId] = fetchPromise;

	// Return the promise
	return fetchPromise;
}

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

		// Fetch all user names from cache or API
		const userNamesPromises = userIds.map((id) => getUserName(id));
		const userNames = await Promise.all(userNamesPromises);

		// Create a map of user names
		const userNameMap: Record<string, string> = {};
		userIds.forEach((id, index) => {
			userNameMap[id] = userNames[index] || "unknown";
		});

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
				userName: userNameMap[take.userId] || "Unknown User",
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
