import type { MessageResponse } from "../types";
import { getActiveTake } from "../services/database";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import TakesConfig from "../../../libs/config";
import { generateSlackDate, prettyPrintTime } from "../../../libs/time";

export default async function handleStart(
	userId: string,
	channelId: string,
	description?: string,
	durationMinutes?: number,
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
		channelId,
		status: "active",
		startedAt: new Date(),
		durationMinutes: durationMinutes || TakesConfig.DEFAULT_SESSION_LENGTH,
		description: description || null,
		notifiedLowTime: false,
		notifiedPauseExpiration: false,
	};

	await db.insert(takesTable).values(newTake);

	// Calculate end time for message
	const endTime = new Date(
		newTake.startedAt.getTime() + newTake.durationMinutes * 60000,
	);

	const descriptionText = description
		? `\n\n*Working on:* ${description}`
		: "";
	return {
		text: `🎬 Takes session started! You have ${prettyPrintTime(newTake.durationMinutes * 60000)} until ${generateSlackDate(endTime)}.${descriptionText}`,
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
						text: `You have ${prettyPrintTime(newTake.durationMinutes * 60000)} left until ${generateSlackDate(endTime)}.`,
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
