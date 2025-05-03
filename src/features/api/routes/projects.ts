import { db } from "../../../libs/db";
import { users as usersTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { eq } from "drizzle-orm";
import { fetchUserData } from "../../../libs/cachet";

export type Project = {
	projectName: string;
	projectDescription: string;
	projectBannerUrl: string;
	/** Total time spent on takes, in seconds */
	totalTakesTime: number;
	userId: string;
	userName?: string;
};

// Cache for user data from cachet
const userCache: Record<string, { name: string; timestamp: number }> = {};
const pendingRequests: Record<string, Promise<string>> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

export async function projects(url: URL): Promise<Response> {
	const user = url.searchParams.get("user");
	try {
		const projects = await db
			.select({
				projectName: usersTable.projectName,
				projectDescription: usersTable.projectDescription,
				projectBannerUrl: usersTable.projectBannerUrl,
				totalTakesTime: usersTable.totalTakesTime,
				userId: usersTable.id,
			})
			.from(usersTable)
			.where(eq(usersTable.id, user ? user : usersTable.id));

		if (projects.length === 0) {
			return new Response(
				JSON.stringify({
					projects: [],
				}),
				{
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}

		// Get unique user IDs
		const userIds = [...new Set(projects.map((project) => project.userId))];

		// Fetch all user names from cache or API
		const userNamesPromises = userIds.map((id) => getUserName(id));
		const userNames = await Promise.all(userNamesPromises);

		// Create a map of user names
		const userNameMap: Record<string, string> = {};
		userIds.forEach((id, index) => {
			userNameMap[id] = userNames[index] || "Unknown User";
		});

		// Add user names to projects
		const projectsWithUserNames = projects.map((project) => ({
			...project,
			userName: userNameMap[project.userId] || "Unknown User",
		}));

		return new Response(
			JSON.stringify({
				projects: user
					? projectsWithUserNames[0]
					: projectsWithUserNames,
			}),
			{
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		return handleApiError(error, "projects");
	}
}
