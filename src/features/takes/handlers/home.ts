import type { MessageResponse } from "../types";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq, and, desc } from "drizzle-orm";
import { prettyPrintTime } from "../../../libs/time";

export default async function handleHome(
	userId: string,
): Promise<MessageResponse> {
	const takes = await db
		.select()
		.from(takesTable)
		.where(and(eq(takesTable.userId, userId)))
		.orderBy(desc(takesTable.createdAt));

	const approvedTakes = takes.reduce((acc, take) => {
		if (take.status !== "approved") return acc;
		const multiplier = Number.parseFloat(take.multiplier || "1.0");
		const hoursElapsed =
			(take.elapsedTimeMs * multiplier) / (1000 * 60 * 60);
		return Number((acc + hoursElapsed).toFixed(1));
	}, 0);

	const waitingTakesStats = takes.reduce(
		(acc: { count: number; hours: number }, take) => {
			if (take.status !== "waitingUpload" && take.status !== "uploaded")
				return acc;
			const multiplier = Number.parseFloat(take.multiplier || "1.0");
			const hoursElapsed =
				(take.elapsedTimeMs * multiplier) / (1000 * 60 * 60);
			return {
				count: acc.count + 1,
				hours: Number((acc.hours + hoursElapsed).toFixed(1)),
			};
		},
		{ count: 0, hours: 0 },
	);

	return {
		text: `You have logged \`${approvedTakes}\` approved takes!`,
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "*Takes Stats*",
				},
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `You have logged \`${approvedTakes}\` takes! \n\n*Pending Approval:* \`${waitingTakesStats.count}\` sessions, \`${waitingTakesStats.hours}\` hours total`,
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🎬 Start New Session",
							emoji: true,
						},
						value: "start",
						action_id: "takes_start",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "📋 History",
							emoji: true,
						},
						value: "history",
						action_id: "takes_history",
					},
				],
			},
		],
	};
}
