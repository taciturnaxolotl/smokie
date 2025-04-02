import type { AnyMessageBlock } from "slack-edge";
import { environment, slackApp, slackClient } from "../index";
import { db } from "../libs/db";
import { takes as takesTable } from "../libs/schema";
import { eq, and, desc } from "drizzle-orm";
import TakesConfig from "../libs/config";
import { generateSlackDate, prettyPrintTime } from "../libs/time";

type MessageResponse = {
	blocks?: AnyMessageBlock[];
	text: string;
	response_type: "ephemeral" | "in_channel";
};

const takes = async () => {
	// Helper functions for command actions
	const getActiveTake = async (userId: string) => {
		return db
			.select()
			.from(takesTable)
			.where(
				and(
					eq(takesTable.userId, userId),
					eq(takesTable.status, "active"),
				),
			)
			.limit(1);
	};

	const getPausedTake = async (userId: string) => {
		return db
			.select()
			.from(takesTable)
			.where(
				and(
					eq(takesTable.userId, userId),
					eq(takesTable.status, "paused"),
				),
			)
			.limit(1);
	};

	const getCompletedTakes = async (userId: string, limit = 5) => {
		return db
			.select()
			.from(takesTable)
			.where(
				and(
					eq(takesTable.userId, userId),
					eq(takesTable.status, "completed"),
				),
			)
			.orderBy(desc(takesTable.completedAt))
			.limit(limit);
	};

	// Check for paused sessions that have exceeded the max pause duration
	const expirePausedSessions = async () => {
		const now = new Date();
		const pausedTakes = await db
			.select()
			.from(takesTable)
			.where(eq(takesTable.status, "paused"));

		for (const take of pausedTakes) {
			if (take.pausedAt) {
				const pausedDuration =
					(now.getTime() - take.pausedAt.getTime()) / (60 * 1000); // Convert to minutes

				// Send warning notification when getting close to expiration
				if (
					pausedDuration >
						TakesConfig.MAX_PAUSE_DURATION -
							TakesConfig.NOTIFICATIONS
								.PAUSE_EXPIRATION_WARNING &&
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

				// Auto-expire paused sessions that exceed the max pause duration
				if (pausedDuration > TakesConfig.MAX_PAUSE_DURATION) {
					let ts: string | undefined;
					// Notify user that their session was auto-completed
					try {
						const res = await slackApp.client.chat.postMessage({
							channel: take.userId,
							text: `⏰ Your paused takes session has been automatically completed because it was paused for more than ${TakesConfig.MAX_PAUSE_DURATION} minutes.\n\nPlease upload your takes video in this thread within the next 24 hours!`,
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
							ts,
							notes: take.notes
								? `${take.notes} (Automatically completed due to pause timeout)`
								: "Automatically completed due to pause timeout",
						})
						.where(eq(takesTable.id, take.id));
				}
			}
		}
	};

	// Check for active sessions that are almost done
	const checkActiveSessions = async () => {
		const now = new Date();
		const activeTakes = await db
			.select()
			.from(takesTable)
			.where(eq(takesTable.status, "active"));

		for (const take of activeTakes) {
			const endTime = new Date(
				take.startedAt.getTime() +
					take.durationMinutes * 60000 +
					(take.pausedTimeMs || 0),
			);

			const remainingMs = endTime.getTime() - now.getTime();
			const remainingMinutes = remainingMs / 60000;

			if (
				remainingMinutes <=
					TakesConfig.NOTIFICATIONS.LOW_TIME_WARNING &&
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

			if (remainingMs <= 0) {
				let ts: string | undefined;
				try {
					const res = await slackApp.client.chat.postMessage({
						channel: take.userId,
						text: "⏰ Your takes session has automatically completed because the time is up. Please upload your takes video in this thread within the next 24 hours!",
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
						ts,
						notes: take.notes
							? `${take.notes} (Automatically completed - time expired)`
							: "Automatically completed - time expired",
					})
					.where(eq(takesTable.id, take.id));
			}
		}
	};

	// Command action handlers
	const handleStart = async (
		userId: string,
		channelId: string,
		description?: string,
		durationMinutes?: number,
	): Promise<MessageResponse> => {
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
			durationMinutes:
				durationMinutes || TakesConfig.DEFAULT_SESSION_LENGTH,
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
	};

	const handlePause = async (
		userId: string,
	): Promise<MessageResponse | undefined> => {
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
	};

	const handleResume = async (
		userId: string,
	): Promise<MessageResponse | undefined> => {
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

		// Calculate paused time
		if (pausedSession.pausedAt) {
			const pausedTimeMs =
				now.getTime() - pausedSession.pausedAt.getTime();
			const totalPausedTime =
				(pausedSession.pausedTimeMs || 0) + pausedTimeMs;

			// Update the takes entry to active status
			await db
				.update(takesTable)
				.set({
					status: "active",
					pausedAt: null,
					pausedTimeMs: totalPausedTime,
					notifiedLowTime: false, // Reset low time notification
				})
				.where(eq(takesTable.id, pausedSession.id));
		}

		const endTime = new Date(
			new Date(pausedSession.startedAt).getTime() +
				pausedSession.durationMinutes * 60000 +
				(pausedSession.pausedTimeMs || 0),
		);

		const timeRemaining = endTime.getTime() - now.getTime();

		return {
			text: `▶️ Takes session resumed! You have ${prettyPrintTime(timeRemaining)} remaining in your session.`,
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
							text: `You have ${prettyPrintTime(timeRemaining)} remaining until ${generateSlackDate(endTime)}.`,
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
	};

	const handleStop = async (
		userId: string,
		args?: string[],
	): Promise<MessageResponse | undefined> => {
		const activeTake = await getActiveTake(userId);

		if (activeTake.length === 0) {
			const pausedTake = await getPausedTake(userId);

			if (pausedTake.length === 0) {
				return {
					text: `You don't have an active or paused takes session!`,
					response_type: "ephemeral",
				};
			}

			// Mark the paused session as completed
			const pausedTakeToStop = pausedTake[0];
			if (!pausedTakeToStop) {
				return;
			}

			// Extract notes if provided
			let notes = undefined;
			if (args && args.length > 1) {
				notes = args.slice(1).join(" ");
			}

			const res = await slackClient.chat.postMessage({
				channel: userId,
				text: "🎬 Your paused takes session has been completed. Please upload your takes video in this thread within the next 24 hours!",
			});

			await db
				.update(takesTable)
				.set({
					status: "waitingUpload",
					ts: res.ts,
					completedAt: new Date(),
					...(notes && { notes }),
				})
				.where(eq(takesTable.id, pausedTakeToStop.id));
		} else {
			// Mark the active session as completed
			const activeTakeToStop = activeTake[0];
			if (!activeTakeToStop) {
				return;
			}

			// Extract notes if provided
			let notes = undefined;
			if (args && args.length > 1) {
				notes = args.slice(1).join(" ");
			}

			const res = await slackClient.chat.postMessage({
				channel: userId,
				text: "🎬 Your takes session has been completed. Please upload your takes video in this thread within the next 24 hours!",
			});

			await db
				.update(takesTable)
				.set({
					status: "waitingUpload",
					ts: res.ts,
					completedAt: new Date(),
					...(notes && { notes }),
				})
				.where(eq(takesTable.id, activeTakeToStop.id));
		}

		return {
			text: "✅ Takes session completed! I hope you had fun!",
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "✅ Takes session completed! I hope you had fun!",
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
	};

	const handleStatus = async (
		userId: string,
	): Promise<MessageResponse | undefined> => {
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

					const weeks = Math.floor(
						diffMs / (1000 * 60 * 60 * 24 * 7),
					);
					if (weeks > 0 && weeks < 4) return `${weeks} weeks`;

					const months = Math.floor(
						diffMs / (1000 * 60 * 60 * 24 * 30),
					);
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
	};

	const handleHistory = async (userId: string): Promise<MessageResponse> => {
		// Get completed takes for the user
		const completedTakes = (
			await getCompletedTakes(userId, TakesConfig.MAX_HISTORY_ITEMS)
		).sort(
			(a, b) =>
				(b.completedAt?.getTime() ?? 0) -
				(a.completedAt?.getTime() ?? 0),
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
	};

	const handleHelp = async (): Promise<MessageResponse> => {
		return {
			text: `*Takes Commands*\n\n• \`/takes start [minutes]\` - Start a new takes session, optionally specifying duration\n• \`/takes pause\` - Pause your current session (max ${TakesConfig.MAX_PAUSE_DURATION} min)\n• \`/takes resume\` - Resume your paused session\n• \`/takes stop [notes]\` - End your current session with optional notes\n• \`/takes status\` - Check the status of your session\n• \`/takes history\` - View your past takes sessions`,
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "*Takes Commands*",
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `• \`/takes start [minutes]\` - Start a new session (default: ${TakesConfig.DEFAULT_SESSION_LENGTH} min)\n• \`/takes pause\` - Pause your session (max ${TakesConfig.MAX_PAUSE_DURATION} min)\n• \`/takes resume\` - Resume your paused session\n• \`/takes stop [notes]\` - End session with optional notes\n• \`/takes status\` - Check status\n• \`/takes history\` - View past sessions`,
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
	};
	const getDescriptionBlocks = (error?: string): MessageResponse => {
		const blocks: AnyMessageBlock[] = [
			{
				type: "input",
				block_id: "note_block",
				element: {
					type: "plain_text_input",
					action_id: "note_input",
					placeholder: {
						type: "plain_text",
						text: "Enter a note for your session",
					},
					multiline: true,
				},
				label: {
					type: "plain_text",
					text: "Note",
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🎬 Start Session",
							emoji: true,
						},
						value: "start",
						action_id: "takes_start",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "⛔ Cancel",
							emoji: true,
						},
						value: "cancel",
						action_id: "takes_status",
						style: "danger",
					},
				],
			},
		];

		if (error) {
			blocks.push(
				{
					type: "divider",
				},
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: `⚠️ ${error}`,
						},
					],
				},
			);
		}

		return {
			text: "Please enter a note for your session:",
			response_type: "ephemeral",
			blocks,
		};
	};

	const getEditDescriptionBlocks = (
		description: string,
		error?: string,
	): MessageResponse => {
		const blocks: AnyMessageBlock[] = [
			{
				type: "input",
				block_id: "note_block",
				element: {
					type: "plain_text_input",
					action_id: "note_input",
					placeholder: {
						type: "plain_text",
						text: "Enter a note for your session",
					},
					multiline: true,
					initial_value: description,
				},
				label: {
					type: "plain_text",
					text: "Note",
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "✍️ Update Note",
							emoji: true,
						},
						value: "start",
						action_id: "takes_edit",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "⛔ Cancel",
							emoji: true,
						},
						value: "cancel",
						action_id: "takes_status",
						style: "danger",
					},
				],
			},
		];

		if (error) {
			blocks.push(
				{
					type: "divider",
				},
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: `⚠️ ${error}`,
						},
					],
				},
			);
		}

		return {
			text: "Please enter a note for your session:",
			response_type: "ephemeral",
			blocks,
		};
	};

	// Main command handler
	slackApp.command(
		environment === "dev" ? "/takes-dev" : "/takes",
		async ({ payload, context }): Promise<void> => {
			const userId = payload.user_id;
			const channelId = payload.channel_id;
			const text = payload.text || "";
			const args = text.trim().split(/\s+/);
			let subcommand = args[0]?.toLowerCase() || "";

			// Check for active takes session
			const activeTake = await getActiveTake(userId);

			// Check for paused session if no active one
			const pausedTakeCheck =
				activeTake.length === 0 ? await getPausedTake(userId) : [];

			// Run checks for expired or about-to-expire sessions
			await expirePausedSessions();
			await checkActiveSessions();

			// Default to status if we have an active or paused session and no command specified
			if (
				subcommand === "" &&
				(activeTake.length > 0 || pausedTakeCheck.length > 0)
			) {
				subcommand = "status";
			} else if (subcommand === "") {
				subcommand = "help";
			}

			let response: MessageResponse | undefined;

			// Special handling for start command to show modal
			if (subcommand === "start" && !activeTake.length) {
				response = getDescriptionBlocks();
			}

			// Route to the appropriate handler function
			switch (subcommand) {
				case "start":
					response = await handleStart(userId, channelId);
					break;
				case "pause":
					response = await handlePause(userId);
					break;
				case "resume":
					response = await handleResume(userId);
					break;
				case "stop":
					response = await handleStop(userId, args);
					break;
				case "edit":
					response = getEditDescriptionBlocks(
						activeTake[0]?.description || "",
					);
					break;
				case "status":
					response = await handleStatus(userId);
					break;
				case "history":
					response = await handleHistory(userId);
					break;
				case "help":
					response = await handleHelp();
					break;
				default:
					response = await handleHelp();
					break;
			}

			if (context.respond)
				await context.respond(
					response || {
						text: "An error occurred while processing your request.",
						response_type: "ephemeral",
					},
				);
		},
	);

	// Handle button actions
	slackApp.action(/^takes_(\w+)$/, async ({ payload, context }) => {
		const userId = payload.user.id;
		const channelId = context.channelId || "";
		const actionId = payload.actions[0]?.action_id as string;
		const command = actionId.replace("takes_", "");
		const descriptionInput = payload.state.values.note_block?.note_input;

		let response: MessageResponse | undefined;

		const activeTake = await getActiveTake(userId);

		// Route to the appropriate handler function
		switch (command) {
			case "start": {
				if (activeTake.length > 0) {
					if (context.respond) {
						response = await handleStatus(userId);
					}
				} else {
					if (!descriptionInput?.value?.trim()) {
						response = getDescriptionBlocks(
							"Please enter a note for your session.",
						);
					} else {
						response = await handleStart(
							userId,
							channelId,
							descriptionInput?.value?.trim(),
						);
					}
				}
				break;
			}
			case "pause":
				response = await handlePause(userId);
				break;
			case "resume":
				response = await handleResume(userId);
				break;
			case "stop":
				response = await handleStop(userId);
				break;
			case "edit": {
				if (!activeTake.length && context.respond) {
					await context.respond({
						text: "You don't have an active takes session to edit!",
						response_type: "ephemeral",
					});
					return;
				}

				if (!descriptionInput) {
					response = getEditDescriptionBlocks(
						activeTake[0]?.description || "",
					);
				} else if (descriptionInput.value?.trim()) {
					const takeToUpdate = activeTake[0];
					if (!takeToUpdate) return;

					// Update the note for the active session
					await db.update(takesTable).set({
						description: descriptionInput.value.trim(),
					});

					response = await handleStatus(userId);
				} else {
					response = getEditDescriptionBlocks(
						"",
						"Please enter a note for your session.",
					);
				}
				break;
			}

			case "status":
				response = await handleStatus(userId);
				break;
			case "history":
				response = await handleHistory(userId);
				break;
			default:
				response = await handleHelp();
				break;
		}

		// Send the response
		if (response && context.respond) {
			await context.respond(response);
		}
	});

	// Setup scheduled tasks
	const notificationInterval = TakesConfig.NOTIFICATIONS.CHECK_INTERVAL;
	setInterval(async () => {
		await checkActiveSessions();
		await expirePausedSessions();
	}, notificationInterval);
};

export default takes;
