import type { AnyMessageBlock } from "slack-edge";
import TakesConfig from "../../../libs/config";
import { getCompletedTakes } from "../services/database";
import type { MessageResponse } from "../types";
import { calculateElapsedTime } from "../../../libs/time-periods";
import { prettyPrintTime } from "../../../libs/time";

export async function handleHistory(userId: string): Promise<MessageResponse> {
	// Get completed takes for the user
	const completedTakes = (
		await getCompletedTakes(userId, TakesConfig.MAX_HISTORY_ITEMS)
	).sort(
		(a, b) =>
			(b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
	);

	if (completedTakes.length === 0) {
		return {
			text: "You haven't completed any takes sessions yet.",
			response_type: "ephemeral",
		};
	}

	// Create blocks for each completed take
	const historyBlocks: AnyMessageBlock[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: `📋 Your most recent ${completedTakes.length} Takes sessions`,
				emoji: true,
			},
		},
	];

	for (const take of completedTakes) {
		const elapsedTime = calculateElapsedTime(JSON.parse(take.periods));

		const notes = take.notes ? `\n• Notes: ${take.notes}` : "";
		const description = take.description
			? `\n• Description: ${take.description}\n`
			: "";

		historyBlocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Duration:* \`${prettyPrintTime(elapsedTime)}\`\n*Status:* ${take.status}\n${notes ? `*Notes:* ${take.notes}\n` : ""}${description ? `*Description:* ${take.description}\n` : ""}`,
			},
		});

		// Add a divider between entries
		if (take !== completedTakes[completedTakes.length - 1]) {
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
					text: "👁️ Status",
					emoji: true,
				},
				value: "status",
				action_id: "takes_status",
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
		text: `Your recent takes history (${completedTakes.length} sessions)`,
		response_type: "ephemeral",
		blocks: historyBlocks,
	};
}
