import type { AnyMessageBlock } from "slack-edge";
import TakesConfig from "../../../libs/config";
import { getCompletedTakes } from "../services/database";
import type { MessageResponse } from "../types";

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
				text: `📋 Your most recent ${completedTakes.length} Takes Sessions`,
				emoji: true,
			},
		},
	];

	for (const take of completedTakes) {
		const startTime = new Date(take.startedAt);
		const endTime = take.completedAt || startTime;

		// Calculate duration in minutes
		const durationMs = endTime.getTime() - startTime.getTime();
		const pausedMs = take.pausedTimeMs || 0;
		const activeDuration = Math.round((durationMs - pausedMs) / 60000);

		// Format dates
		const startDate = `<!date^${Math.floor(startTime.getTime() / 1000)}^{date_short_pretty} at {time}|${startTime.toLocaleString()}>`;
		const endDate = `<!date^${Math.floor(endTime.getTime() / 1000)}^{date_short_pretty} at {time}|${endTime.toLocaleString()}>`;

		const notes = take.notes ? `\n• Notes: ${take.notes}` : "";
		const description = take.description
			? `\n• Description: ${take.description}\n`
			: "";

		historyBlocks.push({
			type: "section",
			text: {
				type: "mrkdwn",
				text: `*Take on ${startDate}*\n${description}• Duration: ${activeDuration} minutes${
					pausedMs > 0
						? ` (+ ${Math.round(pausedMs / 60000)} minutes paused)`
						: ""
				}\n• Started: ${startDate}\n• Completed: ${endDate}${notes}`,
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
