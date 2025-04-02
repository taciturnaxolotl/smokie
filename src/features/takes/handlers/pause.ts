import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq } from "drizzle-orm";
import TakesConfig from "../../../libs/config";
import { getActiveTake } from "../services/database";
import type { MessageResponse } from "../types";
import { prettyPrintTime } from "../../../libs/time";

export default async function handlePause(
	userId: string,
): Promise<MessageResponse | undefined> {
	const activeTake = await getActiveTake(userId);
	if (activeTake.length === 0) {
		return {
			text: `You don't have an active takes session! Use \`/takes start\` to begin.`,
			response_type: "ephemeral",
		};
	}

	const takeToUpdate = activeTake[0];
	if (!takeToUpdate) {
		return;
	}

	// Update the takes entry to paused status
	await db
		.update(takesTable)
		.set({
			status: "paused",
			pausedAt: new Date(),
			notifiedPauseExpiration: false, // Reset pause expiration notification
		})
		.where(eq(takesTable.id, takeToUpdate.id));

	// Calculate when the pause will expire
	const pauseExpires = new Date();
	pauseExpires.setMinutes(
		pauseExpires.getMinutes() + TakesConfig.MAX_PAUSE_DURATION,
	);
	const pauseExpiresStr = `<!date^${Math.floor(pauseExpires.getTime() / 1000)}^{date_short_pretty} at {time}|${pauseExpires.toLocaleString()}>`;

	return {
		text: `⏸️ Session paused! You have ${prettyPrintTime(takeToUpdate.durationMinutes * 60000)} remaining. It will automatically finish in ${TakesConfig.MAX_PAUSE_DURATION} minutes (by ${pauseExpiresStr}) if not resumed.`,
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `⏸️ Session paused! You have ${prettyPrintTime(takeToUpdate.durationMinutes * 60000)} remaining.`,
				},
			},
			{
				type: "divider",
			},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `It will automatically finish in ${TakesConfig.MAX_PAUSE_DURATION} minutes (by ${pauseExpiresStr}) if not resumed.`,
					},
				],
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "✍️ edit",
							emoji: true,
						},
						value: "edit",
						action_id: "takes_edit",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "▶️ Resume",
							emoji: true,
						},
						value: "resume",
						action_id: "takes_resume",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "⏹️ Stop",
							emoji: true,
						},
						value: "stop",
						action_id: "takes_stop",
						style: "danger",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🔄 Refresh",
							emoji: true,
						},
						value: "status",
						action_id: "takes_status",
					},
				],
			},
		],
	};
}
