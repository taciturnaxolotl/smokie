import type { UploadedFile } from "slack-edge";
import { slackApp, slackClient } from "../../../index";
import { db } from "../../../libs/db";
import { eq } from "drizzle-orm";
import { users as usersTable } from "../../../libs/schema";
import {
	getHackatimeApiUrl,
	getHackatimeName,
	getHackatimeVersion,
	HACKATIME_VERSIONS,
	type HackatimeVersion,
} from "../../../libs/hackatime";
import { deployToHackClubCDN } from "../../../libs/cdn";

export async function handleSettings(
	triggerID: string,
	user: string,
	prefill = false,
) {
	let initialValues: {
		project_name: string;
		project_description: string;
		repo_link: string | undefined;
		demo_link: string | undefined;
		hackatime_version: string;
	} = {
		project_name: "",
		project_description: "",
		repo_link: undefined,
		demo_link: undefined,
		hackatime_version: "v2",
	};

	if (prefill) {
		try {
			// Check if user already has a project in the database
			const existingUser = (
				await db
					.select()
					.from(usersTable)
					.where(eq(usersTable.id, user))
			)[0];

			if (existingUser) {
				initialValues = {
					project_name: existingUser.projectName,
					project_description: existingUser.projectDescription,
					repo_link: existingUser.repoLink || undefined,
					demo_link: existingUser.demoLink || undefined,
					hackatime_version: existingUser.hackatimeVersion,
				};
			}
		} catch (error) {
			console.error("Error prefilling form:", error);
		}
	}

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
						initial_value: initialValues.project_name || "",
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
						initial_value: initialValues.project_description || "",
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
						text: `Banner Image${prefill ? " (this will replace your current banner)" : ""}`,
					},
					element: {
						type: "file_input",
						action_id: "project_banner_input",
					},
					optional: prefill,
				},
				{
					type: "input",
					block_id: "repo_link",
					optional: true,
					label: {
						type: "plain_text",
						text: "Repository Link",
					},
					element: {
						type: "plain_text_input",
						action_id: "repo_link_input",
						initial_value: initialValues.repo_link || "",
						placeholder: {
							type: "plain_text",
							text: "Optional: Add a link to your repository",
						},
					},
				},
				{
					type: "input",
					block_id: "demo_link",
					optional: true,
					label: {
						type: "plain_text",
						text: "Demo Link",
					},
					element: {
						type: "plain_text_input",
						action_id: "demo_link_input",
						initial_value: initialValues.demo_link || "",
						placeholder: {
							type: "plain_text",
							text: "Optional: Add a link to your demo",
						},
					},
				},
				{
					type: "input",
					block_id: "hackatime_version",
					label: {
						type: "plain_text",
						text: "Hackatime Version",
					},
					element: {
						type: "static_select",
						action_id: "hackatime_version_input",
						initial_option: {
							text: {
								type: "plain_text",
								text: getHackatimeName(
									initialValues.hackatime_version as HackatimeVersion,
								),
							},
							value: initialValues.hackatime_version,
						},
						options: Object.values(HACKATIME_VERSIONS).map((v) => ({
							text: {
								type: "plain_text",
								text: getHackatimeName(v.id),
							},
							value: v.id,
						})),
					},
				},
			],
		},
	});
}

export async function setupSubmitListener() {
	slackApp.view("takes_setup_submit", async ({ payload, body }) => {
		if (payload.type !== "view_submission") return;
		const values = payload.view.state.values;
		const userId = body.user.id;

		const file = values.project_banner?.project_banner_input?.files?.[0]
			?.url_private_download as string;

		console.log(file);

		try {
			const projectBannerUrl = file
				? await deployToHackClubCDN([file]).then(
						(res) => res.files[0]?.deployedUrl,
					)
				: undefined;

			const hackatimeVersion = values.hackatime_version
				?.hackatime_version_input?.selected_option
				?.value as HackatimeVersion;

			await db
				.insert(usersTable)
				.values({
					id: userId,
					projectName: values.project_name?.project_name_input
						?.value as string,
					projectDescription: values.project_description
						?.project_description_input?.value as string,
					projectBannerUrl,
					repoLink: values.project_link?.repo_link?.value as
						| string
						| undefined,
					demoLink: values.project_link?.demo_link?.value as
						| string
						| undefined,
					hackatimeVersion,
				})
				.onConflictDoUpdate({
					target: usersTable.id,
					set: {
						projectName: values.project_name?.project_name_input
							?.value as string,
						projectDescription: values.project_description
							?.project_description_input?.value as string,
						projectBannerUrl,
						repoLink: values.repo_link?.repo_link_input?.value as
							| string
							| undefined,
						demoLink: values.demo_link?.demo_link_input?.value as
							| string
							| undefined,
						hackatimeVersion,
					},
				});
		} catch (error) {
			console.error("Error processing file:", error);
			throw error;
		}
	});
}
