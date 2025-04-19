import type { AnyMessageBlock } from "slack-edge";
import type { MessageResponse } from "../types";
import { prettyPrintTime } from "../../../libs/time";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq, and, desc } from "drizzle-orm";

export async function handleHistory(userId: string): Promise<MessageResponse> {
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

	// Create blocks for each completed take
	const historyBlocks: AnyMessageBlock[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `📋 you have uploaded ${takes.length} notes for a total of ${takeTime}`,
				emoji: true,
			},
		},
	];

	for (const take of takes) {
		const notes = take.notes ? `\n• Notes: ${take.notes}` : "";
		const duration = prettyPrintTime(take.elapsedTimeMs);

		historyBlocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Duration:* \`${duration}\`\n${notes ? `*Notes:* ${take.notes}\n` : ""}${take.multiplier !== "1.0" ? `\n*Multiplier:* ${take.multiplier}\n` : ""}`,
			},
		});

		// Add a divider between entries
		if (take !== takes[takes.length - 1]) {
			historyBlocks.push({
				type: "divider",
			});
		}
	}

	// Add actions block
	historyBlocks.push({
		type: "actions",
		elements: [
			{
				type: "button",
				text: {
					type: "plain_text",
					text: "🏡 Home",
					emoji: true,
				},
				value: "status",
				action_id: "takes_home",
			},
			{
				type: "button",
				text: {
					type: "plain_text",
					text: "🔄 Refresh",
					emoji: true,
				},
				value: "status",
				action_id: "takes_history",
			},
		],
	});

	return {
		text: `${takes.length} notes for a total of ${takeTime}`,
		response_type: "ephemeral",
		blocks: historyBlocks,
	};
}
