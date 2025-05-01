import { eq } from "drizzle-orm";
import { slackApp, slackClient } from "../../../index";
import { db } from "../../../libs/db";
import { takes as takesTable, users as usersTable } from "../../../libs/schema";
import * as Sentry from "@sentry/bun";
import {
	fetchHackatimeSummary,
	type HackatimeVersion,
} from "../../../libs/hackatime";
import { prettyPrintTime } from "../../../libs/time";
import { deployToHackClubCDN } from "../../../libs/cdn";

export default async function upload() {
	slackApp.anyMessage(async ({ payload, context }) => {
		try {
			const user = payload.user as string;

			if (
				payload.subtype === "bot_message" ||
				payload.subtype === "thread_broadcast" ||
				payload.thread_ts ||
				payload.channel !== process.env.SLACK_LISTEN_CHANNEL
			)
				return;

			const userInDB = await db
				.select()
				.from(usersTable)
				.where(eq(usersTable.id, user))
				.then((users) => users[0] || null);

			if (!userInDB) {
				await slackClient.chat.postMessage({
					channel: payload.channel,
					thread_ts: payload.ts,
					text: "We don't have a project for you; set one up by clicking the button below or by running `/takes`",
					blocks: [
						{
							type: "section",
							text: {
								type: "mrkdwn",
								text: "We don't have a project for you; set one up by clicking the button below or by running `/takes`",
							},
						},
						{
							type: "actions",
							elements: [
								{
									type: "button",
									text: {
										type: "plain_text",
										text: "setup your project",
									},
									action_id: "takes_setup",
								},
							],
						},
						{
							type: "context",
							elements: [
								{
									type: "plain_text",
									text: "don't forget to resend your update after setting up your project!",
								},
							],
						},
					],
				});
				return;
			}

			// Add initial 'loading' reaction to indicate processing
			await slackClient.reactions.add({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "spin-loading",
			});

			// Convert Slack formatting to markdown
			const replaceUserMentions = async (text: string) => {
				const regex = /<@([A-Z0-9]+)>/g;
				const matches = text.match(regex);

				if (!matches) return text;

				let result = text;
				for (const match of matches) {
					const userId = match.match(/[A-Z0-9]+/)?.[0];
					if (!userId) continue;

					try {
						const userInfo = await slackClient.users.info({
							user: userId,
						});
						const name =
							userInfo.user?.profile?.display_name ||
							userInfo.user?.real_name ||
							userId;
						result = result.replace(match, `@${name}`);
					} catch (e) {
						result = result.replace(match, `@${userId}`);
					}
				}
				return result;
			};

			const markdownText = (await replaceUserMentions(payload.text))
				.replace(/\*(.*?)\*/g, "**$1**") // Bold
				.replace(/_(.*?)_/g, "*$1*") // Italic
				.replace(/~(.*?)~/g, "~~$1~~") // Strikethrough
				.replace(/<(https?:\/\/[^|]+)\|([^>]+)>/g, "[$2]($1)"); // Links

			const mediaUrls = payload.files?.length
				? await deployToHackClubCDN(
						payload.files.map((file) => file.url_private),
					).then((res) => res.files)
				: [];

			// fetch time spent on project via hackatime
			const timeSpent = await fetchHackatimeSummary(
				user,
				userInDB.hackatimeVersion as HackatimeVersion,
				JSON.parse(userInDB.hackatimeKeys),
				new Date(userInDB.lastTakeUploadDate),
				new Date(),
			).then((res) => res.total_categories_sum || 0);

			await db.insert(takesTable).values({
				id: Bun.randomUUIDv7(),
				userId: user,
				ts: payload.ts,
				notes: markdownText,
				media: JSON.stringify(mediaUrls),
				elapsedTime: timeSpent,
			});

			await slackClient.reactions.remove({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "spin-loading",
			});

			await slackClient.reactions.add({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "fire",
			});

			await slackClient.chat.postMessage({
				channel: payload.channel,
				thread_ts: payload.ts,
				text: ":inbox_tray: saved! thanks for the upload",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `:inbox_tray: ${mediaUrls.length > 0 ? "uploaded media and " : ""}saved your notes! That's \`${prettyPrintTime(timeSpent * 1000)}\`!`,
						},
					},
				],
			});
		} catch (error) {
			console.error("Error handling file message:", error);
			await slackClient.chat.postMessage({
				channel: payload.channel,
				thread_ts: payload.ts,
				text: ":warning: there was an error processing your upload",
			});

			await slackClient.reactions.remove({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "fire",
			});

			await slackClient.reactions.remove({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "spin-loading",
			});

			await slackClient.reactions.add({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "nukeboom",
			});

			Sentry.captureException(error, {
				extra: {
					channel: payload.channel,
					user: payload.user,
					thread_ts: payload.ts,
				},
				tags: {
					type: "file_upload_error",
				},
			});
		}
	});
}
