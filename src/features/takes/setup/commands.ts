import { environment, slackApp } from "../../../index";
import handleHelp from "../handlers/help";
import { handleHistory } from "../handlers/history";
import type { MessageResponse } from "../types";
import * as Sentry from "@sentry/bun";
import { blog } from "../../../libs/Logger";
import handleHome from "../handlers/home";

export default function setupCommands() {
	// Main command handler
	slackApp.command(
		environment === "dev" ? "/takes-dev" : "/takes",
		async ({ payload, context }): Promise<void> => {
			try {
				const userId = payload.user_id;
				const channelId = payload.channel_id;
				const text = payload.text || "";
				const args = text.trim().split(/\s+/);
				const subcommand = args[0]?.toLowerCase() || "";

				let response: MessageResponse | undefined;

				// Route to the appropriate handler function
				switch (subcommand) {
					case "history":
						response = await handleHistory(userId);
						break;
					case "help":
						response = await handleHelp();
						break;
					default:
						response = await handleHome(userId);
						break;
				}

				if (!response) {
					throw new Error("No response received from handler");
				}

				if (context.respond) {
					await context.respond(response);
				}
			} catch (error) {
				if (error instanceof Error)
					blog(
						`Error in \`${payload.command}\` command: ${error.message}`,
						"error",
					);

				// Capture the error in Sentry
				Sentry.captureException(error, {
					extra: {
						command: payload.command,
						userId: payload.user_id,
						channelId: payload.channel_id,
						text: payload.text,
					},
				});

				// Respond with error message to user
				if (context.respond) {
					await context.respond({
						text: "An error occurred while processing your request. Please be patent while we try to put out the fire.",
						response_type: "ephemeral",
					});
				}
			}
		},
	);
}
