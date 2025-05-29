import { db } from "../../../libs/db";
import { users as usersTable, takes as takesTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { eq, count } from "drizzle-orm";
import { userService } from "../../../libs/cachet";

export type Project = {
	projectName: string;
	projectDescription: string;
	projectBannerUrl: string;
	/** Total time spent on takes, in seconds */
	totalTakesTime: number;
	userId: string;
	userName?: string;
	/** Total number of takes */
	takesCount: number;
	lastUpdated: Date;
	createdAt: Date;
};

// Project cache to reduce database queries
const projectCache = new Map<
	string,
	{ data: Project | Project[]; timestamp: number }
>();
const PROJECT_CACHE_TTL = 60 * 1000; // 1 minute

export async function projects(url: URL): Promise<Response> {
	const user = url.searchParams.get("user");
	try {
		// Check cache before database query
		const cacheKey = user || "all_projects";
		const cached = projectCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < PROJECT_CACHE_TTL) {
			return new Response(
				JSON.stringify({
					projects: cached.data,
				}),
				{
					headers: {
						"Content-Type": "application/json",
					},
				},
			);
		}

		// Use a JOIN query to get projects and takes count in a single database operation
		let projectsWithCounts: {
			projectName: string;
			projectDescription: string;
			projectBannerUrl: string;
			totalTakesTime: number;
			userId: string;
			takesCount: number;
			lastUpdated: string;
			createdAt: string;
		}[];

		if (user) {
			// For a single user, get their project data and takes count directly
			projectsWithCounts = await db
				.select({
					projectName: usersTable.projectName,
					projectDescription: usersTable.projectDescription,
					projectBannerUrl: usersTable.projectBannerUrl,
					totalTakesTime: usersTable.totalTakesTime,
					userId: usersTable.id,
					takesCount: count(takesTable.id).as("takes_count"),
					lastUpdated: usersTable.lastTakeUploadDate,
					createdAt: usersTable.createdAt,
				})
				.from(usersTable)
				.leftJoin(takesTable, eq(usersTable.id, takesTable.userId))
				.where(eq(usersTable.id, user))
				.groupBy(usersTable.id);
		} else {
			// For all users, get project data and takes count
			projectsWithCounts = await db
				.select({
					projectName: usersTable.projectName,
					projectDescription: usersTable.projectDescription,
					projectBannerUrl: usersTable.projectBannerUrl,
					totalTakesTime: usersTable.totalTakesTime,
					userId: usersTable.id,
					takesCount: count(takesTable.id).as("takes_count"),
					lastUpdated: usersTable.lastTakeUploadDate,
					createdAt: usersTable.createdAt,
				})
				.from(usersTable)
				.leftJoin(takesTable, eq(usersTable.id, takesTable.userId))
				.groupBy(usersTable.id);
		}

		if (projectsWithCounts.length === 0) {
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
		const userIds = [
			...new Set(projectsWithCounts.map((project) => project.userId)),
		];

		// Fetch all user names from shared user service
		const userNamesPromises = userIds.map((id) =>
			userService.getUserName(id),
		);
		const userNames = await Promise.all(userNamesPromises);

		// Create a map of user names
		const userNameMap: Record<string, string> = {};
		userIds.forEach((id, index) => {
			userNameMap[id] = userNames[index] || "Unknown User";
		});

		// Add user names to projects and convert lastUpdated to number
		const projectsWithUserNames = projectsWithCounts.map((project) => ({
			...project,
			userName: userNameMap[project.userId] || "Unknown User",
			lastUpdated: new Date(project.lastUpdated),
			createdAt: new Date(project.createdAt),
		})) as Project[];

		// Store in cache
		const result = user ? projectsWithUserNames[0] : projectsWithUserNames;
		projectCache.set(cacheKey, {
			data: result as Project | Project[],
			timestamp: Date.now(),
		});

		return new Response(
			JSON.stringify({
				projects: result,
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
