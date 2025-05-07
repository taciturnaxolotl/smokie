import { db } from "../../../libs/db";
import { users as usersTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { eq } from "drizzle-orm";

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

		return new Response(
			JSON.stringify({
				userId,
				totalTakesTime: userData[0].totalTakesTime || 0,
			}),
			{
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		return handleApiError(error, "userTime");
	}
}
