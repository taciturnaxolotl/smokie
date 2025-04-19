import type { UploadedFile } from "slack-edge";
import { slackApp, slackClient } from "../../../index";
import { db } from "../../../libs/db";
import { users as usersTable } from "../../../libs/schema";

export async function handleSetup(triggerID: string) {
	await slackClient.views.open({
		trigger_id: triggerID,
		view: {
			type: "modal",
			title: {
				type: "plain_text",
				text: "Setup Project",
			},
			submit: {
				type: "plain_text",
				text: "Submit",
			},
			clear_on_close: true,
			callback_id: "takes_setup_submit",
			blocks: [
				{
					type: "input",
					block_id: "project_name",
					label: {
						type: "plain_text",
						text: "Project Name",
					},
					element: {
						type: "plain_text_input",
						action_id: "project_name_input",
						placeholder: {
							type: "plain_text",
							text: "Enter your project name",
						},
					},
				},
				{
					type: "input",
					block_id: "project_description",
					label: {
						type: "plain_text",
						text: "Project Description",
					},
					element: {
						type: "plain_text_input",
						action_id: "project_description_input",
						multiline: true,
						placeholder: {
							type: "plain_text",
							text: "Describe your project",
						},
					},
				},
				{
					type: "input",
					block_id: "project_banner",
					label: {
						type: "plain_text",
						text: "Project Banner Image",
					},
					element: {
						type: "file_input",
						action_id: "project_banner_input",
					},
				},
			],
		},
	});
}

export async function setupSubmitListener() {
	slackApp.view(
		"takes_setup_submit",
		async () => Promise.resolve(),
		async ({ payload, body }) => {
			if (payload.type !== "view_submission") return;
			const values = payload.view.state.values;
			const userId = body.user.id;

			const file = values.project_banner?.project_banner_input
				?.files?.[0] as UploadedFile;
			try {
				// If file is already public, use it directly
				const fileData = file.is_public
					? file
					: (
							await slackClient.files.sharedPublicURL({
								file: file.id,
								token: process.env.SLACK_USER_TOKEN,
							})
						).file;

				const html = await (
					await fetch(fileData?.permalink_public as string)
				).text();
				const projectBannerUrl = html.match(
					/https:\/\/files.slack.com\/files-pri\/[^"]+pub_secret=([^"&]*)/,
				)?.[0];

				await db.insert(usersTable).values({
					id: userId,
					projectName: values.project_name?.project_name_input
						?.value as string,
					projectDescription: values.project_description
						?.project_description_input?.value as string,
					projectBannerUrl,
				});
			} catch (error) {
				console.error("Error processing file:", error);
				throw error;
			}
		},
	);
}
