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

	const takeTimeMs = takes.reduce(
		(acc, take) => acc + take.elapsedTimeMs * Number(take.multiplier),
		0,
	);
	const takeTime = prettyPrintTime(takeTimeMs);

	return {
		text: `You have logged ${takeTime} of takes!`,
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
					text: `You have logged ${takeTime} of takes!`,
				},
			},
			{
				type: "actions",
				elements: [
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
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🔄 Refresh",
							emoji: true,
						},
						value: "status",
						action_id: "takes_home",
					},
				],
			},
		],
	};
}
