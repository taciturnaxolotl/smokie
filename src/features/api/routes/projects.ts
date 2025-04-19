import { db } from "../../../libs/db";
import { users as usersTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";
import { eq } from "drizzle-orm";

export type Project = {
	projectName: string;
	projectDescription: string;
	projectBannerUrl: string;
	/** Total time spent on takes, in seconds */
	totalTakesTime: number;
	userId: string;
};

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

		return new Response(
			JSON.stringify({
				projects: user ? projects[0] : projects,
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
