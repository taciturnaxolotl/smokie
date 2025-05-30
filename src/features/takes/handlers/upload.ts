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
		// Track user ID at the top level so it's available in catch block
		const user = payload.user as string;
		try {

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

			// Check if the user is already uploading - prevent multiple simultaneous uploads
			if (userInDB.isUploading) {
				await slackClient.chat.postMessage({
					channel: payload.channel,
					thread_ts: payload.ts,
					text: "You already have an upload in progress. Please wait for it to complete before sending another one.",
				});
				
				await slackClient.reactions.add({
					channel: payload.channel,
					timestamp: payload.ts,
					name: "hourglass_flowing_sand",
				});
				
				return;
			}

			// Set the upload lock
			await db.update(usersTable)
				.set({ isUploading: true })
				.where(eq(usersTable.id, user));

			// Add initial 'loading' reaction to indicate processing
			await slackClient.reactions.add({
				channel: payload.channel,
				timestamp: payload.ts,
				name: "spin-loading",
			});

			// fetch time spent on project via hackatime
			const timeSpent = await fetchHackatimeSummary(
				user,
				userInDB.hackatimeVersion as HackatimeVersion,
				JSON.parse(userInDB.hackatimeKeys),
				new Date(userInDB.lastTakeUploadDate),
				new Date(),
			).then((res) => res.total_projects_sum || 0);

			if (timeSpent < 360) {
				await slackClient.chat.postMessage({
					channel: payload.channel,
					thread_ts: payload.ts,
					text: "You haven't spent enough time on your project yet! Spend a few more minutes hacking then come back :)",
				});

				await slackClient.reactions.remove({
					channel: payload.channel,
					timestamp: payload.ts,
					name: "spin-loading",
				});

				await slackClient.reactions.add({
					channel: payload.channel,
					timestamp: payload.ts,
					name: "tw_timer_clock",
				});

				return;
			}

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

			const mediaUrls = [];
			// Check if the message is from a private channel
			if (
				payload.channel_type === "im" ||
				payload.channel_type === "mpim" ||
				payload.channel_type === "group"
			) {
				// Process all files in one batch for private channels
				if (payload.files && payload.files.length > 0) {
					const cdnUrls = await deployToHackClubCDN(
						payload.files.map((file) => file.url_private),
					);
					mediaUrls.push(
						...cdnUrls.files.map((file) => file.deployedUrl),
					);
				}
			} else if (payload.files && payload.files.length > 0) {
				// For public channels, process media files in parallel
				const mediaFiles = payload.files.filter(
					(file) =>
						file.mimetype &&
						(file.mimetype.startsWith("image/") ||
							file.mimetype.startsWith("video/")),
				);

				if (mediaFiles.length > 0) {
					const results = await Promise.all(
						mediaFiles.map(async (file) => {
							try {
								const fileres =
									await slackClient.files.sharedPublicURL({
										file: file.id as string,
										token: process.env.SLACK_USER_TOKEN,
									});

								const fetchRes = await fetch(
									fileres.file?.permalink_public as string,
								);
								const html = await fetchRes.text();
								const match = html.match(
									/https:\/\/files.slack.com\/files-pri\/[^"]+pub_secret=([^"&]*)/,
								);

								return match?.[0] || null;
							} catch (error) {
								console.error(
									"Error processing file:",
									file.id,
									error,
								);
								return null;
							}
						}),
					);

					// Filter out null results and add to mediaUrls
					mediaUrls.push(...results.filter(Boolean));
				}
			}

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
			
			// Release the upload lock after successful processing
			await db.update(usersTable)
				.set({ isUploading: false })
				.where(eq(usersTable.id, user));
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

			// Release the upload lock in case of error
			try {
				await db.update(usersTable)
					.set({ isUploading: false })
					.where(eq(usersTable.id, user)); // Now user is in scope
			} catch (lockError) {
				console.error("Error releasing upload lock:", lockError);
			}

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
