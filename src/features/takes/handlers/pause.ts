import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq } from "drizzle-orm";
import TakesConfig from "../../../libs/config";
import { getActiveTake } from "../services/database";
import type { MessageResponse } from "../types";
import { generateSlackDate, prettyPrintTime } from "../../../libs/time";
import {
	addNewPeriod,
	getPausedTimeRemaining,
	getRemainingTime,
} from "../../../libs/time-periods";

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

	const newPeriods = JSON.stringify(
		addNewPeriod(takeToUpdate.periods, "paused"),
	);

	const pausedTime = getPausedTimeRemaining(newPeriods);
	const endTime = getRemainingTime(
		takeToUpdate.targetDurationMs,
		takeToUpdate.periods,
	);

	if (pausedTime > TakesConfig.MAX_PAUSE_DURATION * 60000) {
		return {
			text: `You can't pause for more than ${TakesConfig.MAX_PAUSE_DURATION} minutes!`,
			response_type: "ephemeral",
		};
	}

	// Update the takes entry to paused status
	await db
		.update(takesTable)
		.set({
			status: "paused",
			periods: newPeriods,
			notifiedPauseExpiration: false, // Reset pause expiration notification
		})
		.where(eq(takesTable.id, takeToUpdate.id));

	const descriptionText = takeToUpdate.description
		? `\n\n*Working on:* ${takeToUpdate.description}`
		: "";

	return {
		text: `⏸️ Session paused! You have ${prettyPrintTime(endTime.remaining)} remaining. It will automatically finish at ${generateSlackDate(new Date(Date.now() + TakesConfig.MAX_PAUSE_DURATION * 60000))}`,
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `⏸️ Session paused! You have ${prettyPrintTime(endTime.remaining)} remaining.${descriptionText}`,
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
						text: `It will automatically finish in ${prettyPrintTime(pausedTime)} (by ${generateSlackDate(new Date(new Date().getTime() - pausedTime))}) if not resumed.`,
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
