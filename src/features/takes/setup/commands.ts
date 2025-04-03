import { environment, slackApp } from "../../../index";
import handleHelp from "../handlers/help";
import { handleHistory } from "../handlers/history";
import handlePause from "../handlers/pause";
import handleResume from "../handlers/resume";
import handleStart from "../handlers/start";
import handleStatus from "../handlers/status";
import handleStop from "../handlers/stop";
import { getActiveTake, getPausedTake } from "../services/database";
import {
	checkActiveSessions,
	expirePausedSessions,
} from "../services/notifications";
import type { MessageResponse } from "../types";
import { getDescriptionBlocks, getEditDescriptionBlocks } from "../ui/blocks";

export default function setupCommands() {
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
				case "start": {
					if (args.length < 2) {
						response = getDescriptionBlocks();
						break;
					}

					const descriptionInput = args.slice(1).join(" ");

					if (!descriptionInput.trim()) {
						response = getDescriptionBlocks(
							"Please enter a note for your session.",
						);
						break;
					}

					response = await handleStart(
						userId,
						channelId,
						descriptionInput,
					);
					break;
				}
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
}
