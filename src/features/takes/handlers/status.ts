import TakesConfig from "../../../libs/config";
import { generateSlackDate, prettyPrintTime } from "../../../libs/time";
import {
	getPausedTimeRemaining,
	getRemainingTime,
} from "../../../libs/time-periods";
import {
	getActiveTake,
	getCompletedTakes,
	getPausedTake,
} from "../services/database";
import { expirePausedSessions } from "../services/notifications";
import type { MessageResponse } from "../types";

export default async function handleStatus(
	userId: string,
): Promise<MessageResponse | undefined> {
	const activeTake = await getActiveTake(userId);

	// First, check for expired paused sessions
	await expirePausedSessions();

	if (activeTake.length > 0) {
		const take = activeTake[0];
		if (!take) {
			return;
		}

		const endTime = getRemainingTime(take.targetDurationMs, take.periods);

		// Add description to display if present
		const descriptionText = take.description
			? `\n\n*Working on:* ${take.description}`
			: "";

		return {
			text: `🎬 You have an active takes session with ${prettyPrintTime(endTime.remaining)} remaining.${descriptionText}`,
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `🎬 You have an active takes session${descriptionText}`,
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

	// Check for paused session
	const pausedTakeStatus = await getPausedTake(userId);

	if (pausedTakeStatus.length > 0) {
		const pausedTake = pausedTakeStatus[0];
		if (!pausedTake) {
			return;
		}

		// Calculate how much time remains before auto-completion
		const endTime = getRemainingTime(
			pausedTake.targetDurationMs,
			pausedTake.periods,
		);
		const pauseExpires = getPausedTimeRemaining(pausedTake.periods);

		// Add notes to display if present
		const descriptionText = pausedTake.description
			? `\n\n*Working on:* ${pausedTake.description}`
			: "";

		return {
			text: `⏸️ You have a paused takes session. It will auto-complete in ${prettyPrintTime(pauseExpires)} if not resumed.`,
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
							text: `It will automatically finish in ${prettyPrintTime(pauseExpires)} (by ${generateSlackDate(new Date(new Date().getTime() - pauseExpires))}) if not resumed.`,
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

	// Check history of completed sessions
	const completedSessions = await getCompletedTakes(userId);
	const takeTime = completedSessions.length
		? (() => {
				const diffMs =
					new Date().getTime() -
					// @ts-expect-error - TS doesn't know that we are checking the length
					completedSessions[completedSessions.length - 1]
						?.completedAt;

				const hours = Math.ceil(diffMs / (1000 * 60 * 60));
				if (hours < 24) return `${hours} hours`;

				const weeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
				if (weeks > 0 && weeks < 4) return `${weeks} weeks`;

				const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
				return `${months} months`;
			})()
		: 0;

	return {
		text: `You have no active takes sessions. You've completed ${completedSessions.length} sessions in the last ${takeTime}.`,
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: `You have no active takes sessions. You've completed ${completedSessions.length} sessions in the last ${takeTime}.`,
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
