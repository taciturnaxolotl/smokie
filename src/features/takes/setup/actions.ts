import { slackApp } from "../../../index";
import { blog } from "../../../libs/Logger";
import handleHelp from "../handlers/help";
import { handleHistory } from "../handlers/history";
import handleHome from "../handlers/home";
import { handleSettings, setupSubmitListener } from "../handlers/settings";
import upload from "../handlers/upload";
import type { MessageResponse } from "../types";
import * as Sentry from "@sentry/bun";

export default function setupActions() {
	// Handle button actions
	slackApp.action(
		/^takes_(\w+)$/,
		async () => Promise.resolve(),
		async ({ payload, context }) => {
			try {
				const userId = payload.user.id;
				const actionId = payload.actions[0]?.action_id as string;
				const command = actionId.replace("takes_", "");

				let response: MessageResponse | undefined;

				// Route to the appropriate handler function
				switch (command) {
					case "history":
						response = await handleHistory(userId);
						break;
					case "help":
						response = await handleHelp();
						break;
					case "home":
						response = await handleHome(userId);
						break;
					case "settings":
						await handleSettings(
							context.triggerId as string,
							userId,
							true,
						);
						if (context.respond)
							await context.respond({ delete_original: true });
						return;
					case "setup":
						await handleSettings(
							context.triggerId as string,
							userId,
						);
						return;
					default:
						response = await handleHome(userId);
						break;
				}

				// Send the response
				if (response && context.respond) {
					await context.respond(response);
				}
			} catch (error) {
				if (error instanceof Error)
					blog(
						`Error in \`${payload.actions[0]?.action_id}\` action: ${error.message}`,
						"error",
					);

				// Capture the error in Sentry
				Sentry.captureException(error, {
					extra: {
						actionId: payload.actions[0]?.action_id,
						userId: payload.user.id,
						channelId: context.channelId,
					},
				});

				// Respond with error message to user
				if (context.respond) {
					await context.respond({
						text: "An error occurred while processing your request. Please stand by while we try to put out the fire.",
						response_type: "ephemeral",
					});
				}
			}
		},
	);

	// setup the upload actions
	try {
		upload();
	} catch (error) {
		Sentry.captureException(error, {
			extra: {
				context: "upload setup",
			},
		});
	}

	// setup the setup view handler
	try {
		setupSubmitListener();
	} catch (error) {
		Sentry.captureException(error, {
			extra: {
				context: "submit modal setup",
			},
		});
	}
}
