import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq } from "drizzle-orm";
import { generateSlackDate, prettyPrintTime } from "../../../libs/time";
import { getPausedTake } from "../services/database";
import type { MessageResponse } from "../types";
import { addNewPeriod, getRemainingTime } from "../../../libs/time-periods";

export default async function handleResume(
	userId: string,
): Promise<MessageResponse | undefined> {
	const pausedTake = await getPausedTake(userId);
	if (pausedTake.length === 0) {
		return {
			text: `You don't have a paused takes session!`,
			response_type: "ephemeral",
		};
	}

	const pausedSession = pausedTake[0];
	if (!pausedSession) {
		return;
	}

	const now = new Date();
	const newPeriods = JSON.stringify(
		addNewPeriod(pausedSession.periods, "active"),
	);

	// Update the takes entry to active status
	await db
		.update(takesTable)
		.set({
			status: "active",
			lastResumeAt: now,
			periods: newPeriods,
			notifiedLowTime: false, // Reset low time notification
		})
		.where(eq(takesTable.id, pausedSession.id));

	const endTime = getRemainingTime(
		pausedSession.targetDurationMs,
		pausedSession.periods,
	);

	return {
		text: `▶️ Takes session resumed! You have ${prettyPrintTime(endTime.remaining)} remaining in your session.`,
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "▶️ Takes session resumed!",
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
						text: `You have ${prettyPrintTime(endTime.remaining)} remaining until ${generateSlackDate(endTime.endTime)}.`,
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
