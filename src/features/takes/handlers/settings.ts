import { slackApp, slackClient } from "../../../index";
import { db } from "../../../libs/db";
import { eq } from "drizzle-orm";
import { users as usersTable } from "../../../libs/schema";
import {
	fetchRecentProjectKeys,
	getHackatimeName,
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
		hackatime_version: HackatimeVersion;
		hackatime_keys: string[];
	} = {
		project_name: "",
		project_description: "",
		repo_link: undefined,
		demo_link: undefined,
		hackatime_version: "v1",
		hackatime_keys: [],
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
					hackatime_version:
						existingUser.hackatimeVersion as HackatimeVersion,
					hackatime_keys: existingUser.hackatimeKeys
						? JSON.parse(existingUser.hackatimeKeys)
						: [],
				};
			}
		} catch (error) {
			console.error("Error prefilling form:", error);
		}
	}

	const hackatimeKeys = await fetchRecentProjectKeys(
		user,
		10,
		initialValues.hackatime_version as HackatimeVersion,
	);

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
						initial_value: initialValues.project_name,
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
						initial_value: initialValues.project_description,
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
						initial_value: initialValues.repo_link,
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
						initial_value: initialValues.demo_link,
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
									initialValues.hackatime_version,
								),
							},
							value: initialValues.hackatime_version,
						},
						options: Object.values(HACKATIME_VERSIONS).map((v) => ({
							text: {
								type: "plain_text",
								text: v.name,
							},
							value: v.id,
						})),
					},
				},
				hackatimeKeys.length > 0
					? {
							type: "input",
							block_id: "project_keys",
							label: {
								type: "plain_text",
								text: "Project Keys",
							},
							element: {
								type: "multi_static_select",
								action_id: "project_keys_input",
								initial_options:
									initialValues.hackatime_keys.length === 0
										? undefined
										: initialValues.hackatime_keys.map(
												(key) => ({
													text: {
														type: "plain_text",
														text: key,
													},
													value: key,
												}),
											),
								options: hackatimeKeys.map((key) => ({
									text: {
										type: "plain_text",
										text: key,
									},
									value: key,
								})),
							},
						}
					: {
							type: "section",
							text: {
								text: "You don't have any hackatime projects. Go setup hackatime with `/hackatime`",
								type: "mrkdwn",
							},
						},
			],
		},
	});
}

export async function setupSubmitListener() {
	slackApp.view("takes_setup_submit", async ({ payload, context }) => {
		if (payload.type !== "view_submission") return;
		const values = payload.view.state.values;
		const userId = payload.user.id;

		const file = values.project_banner?.project_banner_input?.files?.[0]
			?.url_private_download as string;

		const hackatimeKeys = JSON.stringify(
			values.project_keys?.project_keys_input?.selected_options?.map(
				(option) => option.value,
			) || [],
		);

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
					projectName: values.project_name?.project_name_input?.value,
					projectDescription:
						values.project_description?.project_description_input
							?.value,
					projectBannerUrl,
					repoLink: values.repo_link?.repo_link_input?.value,
					demoLink: values.demo_link?.demo_link_input?.value,
					hackatimeVersion,
					hackatimeKeys,
				})
				.onConflictDoUpdate({
					target: usersTable.id,
					set: {
						projectName:
							values.project_name?.project_name_input?.value,
						projectDescription:
							values.project_description
								?.project_description_input?.value,
						projectBannerUrl,
						repoLink: values.repo_link?.repo_link_input?.value,
						demoLink: values.demo_link?.demo_link_input?.value,
						hackatimeVersion,
						hackatimeKeys,
					},
				});
		} catch (error) {
			console.error("Error processing file:", error);
			throw error;
		}
	});
}
