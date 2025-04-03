import type { MessageResponse } from "../types";
import { getActiveTake } from "../services/database";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import TakesConfig from "../../../libs/config";
import { generateSlackDate, prettyPrintTime } from "../../../libs/time";
import { getRemainingTime } from "../../../libs/time-periods";

export default async function handleStart(
	userId: string,
	channelId: string,
	description?: string,
): Promise<MessageResponse> {
	const activeTake = await getActiveTake(userId);
	if (activeTake.length > 0) {
		return {
			text: "You already have an active takes session! Use `/takes status` to check it.",
			response_type: "ephemeral",
		};
	}

	// Create new takes session
	const newTake = {
		id: Bun.randomUUIDv7(),
		userId,
		status: "active",
		targetDurationMs: TakesConfig.DEFAULT_SESSION_LENGTH * 60000,
		periods: JSON.stringify([
			{
				type: "active",
				startTime: Date.now(),
				endTime: null,
			},
		]),
		elapsedTimeMs: 0,
		description: description || null,
		notifiedLowTime: false,
		notifiedPauseExpiration: false,
	};

	await db.insert(takesTable).values(newTake);

	// Calculate end time for message
	const endTime = getRemainingTime(
		TakesConfig.DEFAULT_SESSION_LENGTH * 60000,
		newTake.periods,
	);

	const descriptionText = description
		? `\n\n*Working on:* ${description}`
		: "";
	return {
		text: `🎬 Takes session started! You have ${prettyPrintTime(endTime.remaining)} until ${generateSlackDate(endTime.endTime)}.${descriptionText}`,
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `🎬 Takes session started!${descriptionText}`,
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
						text: `You have ${prettyPrintTime(endTime.remaining)} left until ${generateSlackDate(endTime.endTime)}.`,
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
							text: "⏸️ Pause",
							emoji: true,
						},
						value: "pause",
						action_id: "takes_pause",
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
