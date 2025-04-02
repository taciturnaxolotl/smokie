import type { AnyMessageBlock } from "slack-edge";
import { slackApp } from "../index";
import { db } from "../libs/db";
import { takes as takesTable } from "../libs/schema";
import { eq, and, isNull } from "drizzle-orm";

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

	const getCompletedTakes = async (userId: string) => {
		return db
			.select()
			.from(takesTable)
			.where(
				and(
					eq(takesTable.userId, userId),
					eq(takesTable.status, "completed"),
				),
			);
	};

	// Command action handlers
	const handleStart = async (
		userId: string,
		channelId: string,
	): Promise<MessageResponse> => {
		const activeTake = await getActiveTake(userId);
		if (activeTake.length > 0) {
			return {
				text: `You already have an active takes session! Use \`/takes status\` to check it.`,
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
			durationMinutes: 5, // 5 minutes for testing (should be 90)
		};

		await db.insert(takesTable).values(newTake);

		// Calculate end time for message
		const endTime = new Date(
			newTake.startedAt.getTime() + newTake.durationMinutes * 60000,
		);
		const endTimeStr = `<!date^${Math.floor(endTime.getTime() / 1000)}^{time}|${endTime.toLocaleTimeString()}>`;

		return {
			text: `🎬 Takes session started! You have ${newTake.durationMinutes} minutes until ${endTimeStr}.`,
			response_type: "in_channel",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `🎬 Takes session started! You have ${newTake.durationMinutes} minutes until ${endTimeStr}.`,
					},
				},
				{
					type: "actions",
					elements: [
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
			})
			.where(eq(takesTable.id, takeToUpdate.id));

		return {
			text: `⏸️ Takes session paused! Use \`/takes resume\` to continue.`,
			response_type: "in_channel",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `⏸️ Takes session paused!`,
					},
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
				})
				.where(eq(takesTable.id, pausedSession.id));
		}

		return {
			text: `▶️ Takes session resumed!`,
			response_type: "in_channel",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `▶️ Takes session resumed!`,
					},
				},
				{
					type: "actions",
					elements: [
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
					],
				},
			],
		};
	};

	const handleStop = async (
		userId: string,
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

			await db
				.update(takesTable)
				.set({
					status: "completed",
					completedAt: new Date(),
				})
				.where(eq(takesTable.id, pausedTakeToStop.id));
		} else {
			// Mark the active session as completed
			const activeTakeToStop = activeTake[0];
			if (!activeTakeToStop) {
				return;
			}

			await db
				.update(takesTable)
				.set({
					status: "completed",
					completedAt: new Date(),
				})
				.where(eq(takesTable.id, activeTakeToStop.id));
		}

		return {
			text: `✅ Takes session completed! Thanks for your contribution.`,
			response_type: "in_channel",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `✅ Takes session completed! Thanks for your contribution.`,
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
					],
				},
			],
		};
	};

	const handleStatus = async (
		userId: string,
	): Promise<MessageResponse | undefined> => {
		const activeTake = await getActiveTake(userId);

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
			let remaining: string;
			if (remainingMs < 120000) {
				// Less than 2 minutes
				remaining = `${Math.max(0, Math.floor(remainingMs / 1000))} seconds`;
			} else {
				remaining = `${Math.max(0, Math.floor(remainingMs / 60000))} minutes`;
			}

			return {
				text: `You have an active takes session with ${remaining} minutes remaining.`,
				response_type: "ephemeral",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `You have an active takes session with *${remaining}* remaining.`,
						},
					},
					{
						type: "actions",
						elements: [
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
						],
					},
				],
			};
		}

		// Check for paused session
		const pausedTakeStatus = await getPausedTake(userId);

		if (pausedTakeStatus.length > 0) {
			return {
				text: `You have a paused takes session. Use \`/takes resume\` to continue.`,
				response_type: "ephemeral",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `You have a paused takes session.`,
						},
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
						],
					},
				],
			};
		}

		// Check history of completed sessions
		const completedSessions = await getCompletedTakes(userId);

		return {
			text: `You have no active takes sessions. You've completed ${completedSessions.length} sessions in the past.`,
			response_type: "ephemeral",
			blocks: [
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: `You have no active takes sessions. You've completed ${completedSessions.length} sessions in the past.`,
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
					],
				},
			],
		};
	};

	const handleHelp = async (): Promise<MessageResponse> => {
		return {
			text: `*Takes Commands*\n\n• \`/takes start\` - Start a new takes session\n• \`/takes pause\` - Pause your current session\n• \`/takes resume\` - Resume your paused session\n• \`/takes stop\` - End your current session\n• \`/takes status\` - Check the status of your session`,
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
						text: "• `/takes start` - Start a new takes session\n• `/takes pause` - Pause your current session\n• `/takes resume` - Resume your paused session\n• `/takes stop` - End your current session\n• `/takes status` - Check the status of your session",
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
					],
				},
			],
		};
	};

	// Main command handler
	slackApp.command("/takes", async ({ payload, context }): Promise<void> => {
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
				response = await handleStop(userId);
				break;
			case "status":
				response = await handleStatus(userId);
				break;
			default:
			case "help":
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
	});

	// Handle button actions
	slackApp.action(/^takes_(\w+)$/, async ({ body, context }) => {
		const userId = body.user.id;
		const channelId = body.channel?.id || "";
		const actionId = body.actions[0].action_id;
		const command = actionId.replace("takes_", "");

		let response: MessageResponse | undefined;

		// Route to the appropriate handler function
		switch (command) {
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
				response = await handleStop(userId);
				break;
			case "status":
				response = await handleStatus(userId);
				break;
			default:
				response = await handleHelp();
				break;
		}

		if (context.respond)
			await context.respond(
				response || {
					text: "An error occurred while processing your request.",
				},
			);
	});
};

export default takes;
