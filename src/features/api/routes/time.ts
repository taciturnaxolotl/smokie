import { db } from "../../../libs/db";
import { users as usersTable, takes as takesTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { eq, sql } from "drizzle-orm";

// Time data cache to reduce database queries
const timeCache = new Map<
	string,
	{
		data: {
			userId: string;
			totalTakesTime: number;
			dailyStats: { date: string; seconds: number }[];
		};
		timestamp: number;
	}
>();
const TIME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export async function time(url: URL): Promise<Response> {
	try {
		const userId = url.searchParams.get("userId");

		if (!userId) {
			return new Response(
				JSON.stringify({
					error: "User ID is required",
				}),
				{
					headers: {
						"Content-Type": "application/json",
					},
					status: 400,
				},
			);
		}

		// Check cache before database query
		const cacheKey = `time_${userId}`;
		const cached = timeCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < TIME_CACHE_TTL) {
			return new Response(JSON.stringify(cached.data), {
				headers: {
					"Content-Type": "application/json",
				},
			});
		}

		// Get user's total takes time from the database
		const userData = await db
			.select({
				totalTakesTime: usersTable.totalTakesTime,
			})
			.from(usersTable)
			.where(eq(usersTable.id, userId))
			.limit(1);

		if (!userData[0]) {
			return new Response(
				JSON.stringify({
					error: "User not found",
				}),
				{
					headers: {
						"Content-Type": "application/json",
					},
					status: 404,
				},
			);
		}

		// Get time logged per day
		const dailyStats = await db
			.select({
				date: sql<string>`DATE(${takesTable.createdAt})`,
				dailyTotal: sql<number>`SUM(${takesTable.elapsedTime})`,
			})
			.from(takesTable)
			.where(eq(takesTable.userId, userId))
			.groupBy(sql`DATE(${takesTable.createdAt})`)
			.orderBy(sql`DATE(${takesTable.createdAt}) DESC`);

		const responseData = {
			userId,
			totalTakesTime: userData[0].totalTakesTime || 0,
			dailyStats: dailyStats.map((day) => ({
				date: day.date,
				seconds: day.dailyTotal,
			})),
		};

		// Store in cache
		timeCache.set(cacheKey, {
			data: responseData,
			timestamp: Date.now(),
		});

		return new Response(JSON.stringify(responseData), {
			headers: {
				"Content-Type": "application/json",
			},
		});
	} catch (error) {
		return handleApiError(error, "userTime");
	}
}
