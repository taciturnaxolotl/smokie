import TakesConfig from "../../../libs/config";
import { generateSlackDate, prettyPrintTime } from "../../../libs/time";
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

		const startTime = new Date(take.startedAt);
		const endTime = new Date(
			startTime.getTime() + take.durationMinutes * 60000,
		);

		// Adjust for paused time
		if (take.pausedTimeMs) {
			endTime.setTime(endTime.getTime() + take.pausedTimeMs);
		}

		const now = new Date();
		const remainingMs = endTime.getTime() - now.getTime();

		// Add description to display if present
		const descriptionText = take.description
			? `\n\n*Working on:* ${take.description}`
			: "";

		return {
			text: `🎬 You have an active takes session with ${prettyPrintTime(remainingMs)} remaining.${descriptionText}`,
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
							text: `You have ${prettyPrintTime(remainingMs)} remaining until ${generateSlackDate(endTime)}.`,
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
		if (!pausedTake || !pausedTake.pausedAt) {
			return;
		}

		// Calculate how much time remains before auto-completion
		const now = new Date();
		const pausedDuration =
			(now.getTime() - pausedTake.pausedAt.getTime()) / (60 * 1000); // In minutes
		const remainingPauseTime = Math.max(
			0,
			TakesConfig.MAX_PAUSE_DURATION - pausedDuration,
		);

		// Format the pause timeout
		const pauseExpires = new Date(pausedTake.pausedAt);
		pauseExpires.setMinutes(
			pauseExpires.getMinutes() + TakesConfig.MAX_PAUSE_DURATION,
		);
		const pauseExpiresStr = `<!date^${Math.floor(pauseExpires.getTime() / 1000)}^{date_short_pretty} at {time}|${pauseExpires.toLocaleString()}>`;

		// Add notes to display if present
		const noteText = pausedTake.notes
			? `\n\n*Working on:* ${pausedTake.notes}`
			: "";

		return {
			text: `⏸️ You have a paused takes session. It will auto-complete in ${remainingPauseTime.toFixed(1)} minutes if not resumed.`,
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `⏸️ Session paused! You have ${prettyPrintTime(pausedTake.durationMinutes * 60000)} remaining.`,
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
					completedSessions[
						completedSessions.length - 1
					].startedAt.getTime();

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
