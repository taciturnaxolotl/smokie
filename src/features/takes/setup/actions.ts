import { slackApp } from "../../../index";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import handleHelp from "../handlers/help";
import { handleHistory } from "../handlers/history";
import handlePause from "../handlers/pause";
import handleResume from "../handlers/resume";
import handleStart from "../handlers/start";
import handleStatus from "../handlers/status";
import handleStop from "../handlers/stop";
import { getActiveTake } from "../services/database";
import upload from "../services/upload";
import type { MessageResponse } from "../types";
import { getDescriptionBlocks, getEditDescriptionBlocks } from "../ui/blocks";

export default function setupActions() {
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

	// setup the upload actions
	upload();
}
