import { slackApp } from "../../../index";
import TakesConfig from "../../../libs/config";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq } from "drizzle-orm";
import {
	calculateElapsedTime,
	getPausedDuration,
	getRemainingTime,
} from "../../../libs/time-periods";
import { prettyPrintTime } from "../../../libs/time";

// Check for paused sessions that have exceeded the max pause duration
export async function expirePausedSessions() {
	const now = new Date();
	const pausedTakes = await db
		.select()
		.from(takesTable)
		.where(eq(takesTable.status, "paused"));

	for (const take of pausedTakes) {
		const pausedDuration = getPausedDuration(take.periods) / 60000; // Convert to minutes

		// Send warning notification when getting close to expiration
		if (
			pausedDuration >
				TakesConfig.MAX_PAUSE_DURATION -
					TakesConfig.NOTIFICATIONS.PAUSE_EXPIRATION_WARNING &&
			!take.notifiedPauseExpiration
		) {
			// Update notification flag
			await db
				.update(takesTable)
				.set({
					notifiedPauseExpiration: true,
				})
				.where(eq(takesTable.id, take.id));

			// Send warning message
			try {
				const timeRemaining = Math.round(
					TakesConfig.MAX_PAUSE_DURATION - pausedDuration,
				);
				await slackApp.client.chat.postMessage({
					channel: take.userId,
					text: `⚠️ Reminder: Your paused takes session will automatically complete in about ${timeRemaining} minutes if not resumed.`,
				});
			} catch (error) {
				console.error(
					"Failed to send pause expiration warning:",
					error,
				);
			}
		}

		// Calculate elapsed time
		const elapsedTime = calculateElapsedTime(JSON.parse(take.periods));

		// Auto-expire paused sessions that exceed the max pause duration
		if (pausedDuration > TakesConfig.MAX_PAUSE_DURATION) {
			let ts: string | undefined;
			// Notify user that their session was auto-completed
			try {
				const res = await slackApp.client.chat.postMessage({
					channel: take.userId,
					text: `⏰ Your paused takes session has been automatically completed because it was paused for more than ${TakesConfig.MAX_PAUSE_DURATION} minutes.\n\nPlease upload your takes video in this thread within the next 24 hours!`,
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: `⏰ Your paused takes session has been automatically completed because it was paused for more than ${TakesConfig.MAX_PAUSE_DURATION} minutes.\n\nPlease upload your takes video in this thread within the next 24 hours!`,
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
									text: `\`${prettyPrintTime(elapsedTime)}\`${take.description ? ` working on: *${take.description}*` : ""}`,
								},
							],
						},
					],
				});
				ts = res.ts;
			} catch (error) {
				console.error(
					"Failed to notify user of auto-completed session:",
					error,
				);
			}

			await db
				.update(takesTable)
				.set({
					status: "waitingUpload",
					completedAt: now,
					elapsedTimeMs: elapsedTime,
					ts,
					notes: take.notes
						? `${take.notes} (Automatically completed due to pause timeout)`
						: "Automatically completed due to pause timeout",
				})
				.where(eq(takesTable.id, take.id));
		}
	}
}

// Check for active sessions that are almost done
export async function checkActiveSessions() {
	const now = new Date();
	const activeTakes = await db
		.select()
		.from(takesTable)
		.where(eq(takesTable.status, "active"));

	for (const take of activeTakes) {
		const endTime = getRemainingTime(take.targetDurationMs, take.periods);

		const remainingMinutes = endTime.remaining / 60000;

		if (
			remainingMinutes <= TakesConfig.NOTIFICATIONS.LOW_TIME_WARNING &&
			remainingMinutes > 0 &&
			!take.notifiedLowTime
		) {
			await db
				.update(takesTable)
				.set({ notifiedLowTime: true })
				.where(eq(takesTable.id, take.id));

			console.log("Sending low time warning to user");

			try {
				await slackApp.client.chat.postMessage({
					channel: take.userId,
					text: `⏱️ Your takes session has less than ${TakesConfig.NOTIFICATIONS.LOW_TIME_WARNING} minutes remaining.`,
				});
			} catch (error) {
				console.error("Failed to send low time warning:", error);
			}
		}

		const elapsedTime = calculateElapsedTime(JSON.parse(take.periods));

		if (endTime.remaining <= 0) {
			let ts: string | undefined;
			try {
				const res = await slackApp.client.chat.postMessage({
					channel: take.userId,
					text: "⏰ Your takes session has automatically completed because the time is up. Please upload your takes video in this thread within the next 24 hours!",
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: "⏰ Your takes session has automatically completed because the time is up. Please upload your takes video in this thread within the next 24 hours!",
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
									text: `\`${prettyPrintTime(elapsedTime)}\`${take.description ? ` working on: *${take.description}*` : ""}`,
								},
							],
						},
					],
				});

				ts = res.ts;
			} catch (error) {
				console.error(
					"Failed to notify user of completed session:",
					error,
				);
			}

			await db
				.update(takesTable)
				.set({
					status: "waitingUpload",
					completedAt: now,
					elapsedTimeMs: elapsedTime,
					ts,
					notes: take.notes
						? `${take.notes} (Automatically completed - time expired)`
						: "Automatically completed - time expired",
				})
				.where(eq(takesTable.id, take.id));
		}
	}
}
