import { eq, desc, and } from "drizzle-orm";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { handleApiError } from "../../../libs/apiError";

export async function recentTakes(): Promise<Response> {
	try {
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
	} catch (error) {
		return handleApiError(error, "recentTakes");
	}
}

export async function takesPerUser(userId: string): Promise<Response> {
	try {
		const rawTakes = await db
			.select()
			.from(takesTable)
			.where(and(eq(takesTable.userId, userId)))
			.orderBy(desc(takesTable.completedAt));

		const takes = rawTakes.map((take) => ({
			id: take.id,
			description: take.description,
			completedAt: take.completedAt,
			status: take.status,
			mp4Url: take.takeUrl,
			elapsedTime: take.elapsedTimeMs,
		}));

		const approvedTakes = rawTakes.reduce((acc, take) => {
			if (take.status !== "approved") return acc;
			const multiplier = Number.parseFloat(take.multiplier || "1.0");
			return Number(
				(
					acc +
					(take.elapsedTimeMs * multiplier) / (1000 * 60 * 60)
				).toFixed(1),
			);
		}, 0);

		const waitingTakes = rawTakes.reduce((acc, take) => {
			if (take.status !== "waitingUpload" && take.status !== "uploaded")
				return acc;
			const multiplier = Number.parseFloat(take.multiplier || "1.0");
			return Number(
				(
					acc +
					(take.elapsedTimeMs * multiplier) / (1000 * 60 * 60)
				).toFixed(1),
			);
		}, 0);

		const rejectedTakes = rawTakes.reduce((acc, take) => {
			if (take.status !== "rejected") return acc;
			const multiplier = Number.parseFloat(take.multiplier || "1.0");
			return Number(
				(
					acc +
					(take.elapsedTimeMs * multiplier) / (1000 * 60 * 60)
				).toFixed(1),
			);
		}, 0);

		return new Response(
			JSON.stringify({
				approvedTakes,
				waitingTakes,
				rejectedTakes,
				takes,
			}),
			{
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		return handleApiError(error, "takesPerUser");
	}
}
