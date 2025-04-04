import { slackApp, slackClient } from "../../../index";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq, and } from "drizzle-orm";
import { prettyPrintTime } from "../../../libs/time";
import * as Sentry from "@sentry/bun";

export default async function upload() {
	slackApp.anyMessage(async ({ payload }) => {
		try {
			if (payload.subtype !== "file_share") return;
			const user = payload.user;

			if (!user) return;

			if (!payload.channel.startsWith("D")) return;

			const takesNeedUpload = await db
				.select()
				.from(takesTable)
				.where(
					and(
						eq(takesTable.userId, payload.user as string),
						eq(takesTable.ts, payload.thread_ts as string),
						eq(takesTable.status, "waitingUpload"),
					),
				);

			if (takesNeedUpload.length === 0) return;

			const take = takesNeedUpload[0];

			if (!payload.files || !take) return;

			const file = payload.files[0];

			if (!file || !file.id || !file.thumb_video || !file.mp4) {
				await slackClient.reactions.add({
					channel: payload.channel,
					timestamp: payload.ts as string,
					name: "no",
				});

				slackClient.chat.postMessage({
					channel: payload.channel,
					thread_ts: payload.thread_ts,
					text: "that's not a video file? 🤔",
				});
				return;
			}

			const fileres = await slackClient.files.sharedPublicURL({
				file: file.id,
				token: process.env.SLACK_USER_TOKEN,
			});

			const fetchRes = await fetch(
				fileres.file?.permalink_public as string,
			);
			const html = await fetchRes.text();
			const match = html.match(/src="([^"]*\.mp4[^"]*)"/);
			const takePublicUrl = match?.[1];

			const takeUploadedAt = new Date();

			await db
				.update(takesTable)
				.set({
					status: "uploaded",
					takeUploadedAt,
					takeUrl: takePublicUrl,
				})
				.where(eq(takesTable.id, take.id));

			await slackClient.reactions.add({
				channel: payload.channel,
				timestamp: payload.ts as string,
				name: "fire",
			});

			await slackClient.chat.postMessage({
				channel: payload.channel,
				thread_ts: payload.thread_ts,
				text: ":video_camera: uploaded! leme send this to the team for review real quick",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: ":video_camera: uploaded! leme send this to the team for review real quick",
						},
					},
					{
						type: "divider",
					},
					{
						type: "context",
						elements: [
							{
								type: "mrkdwn",
								text: `take by <@${user}> for \`${prettyPrintTime(take.elapsedTimeMs)}\` working on: *${take.description}*`,
							},
						],
					},
				],
			});

			await slackClient.chat.postMessage({
				channel: process.env.SLACK_REVIEW_CHANNEL || "",
				text: ":video_camera: new take uploaded!",
				blocks: [
					{
						type: "section",
						text: {
							type: "mrkdwn",
							text: `:video_camera: new take uploaded by <@${user}> for \`${prettyPrintTime(take.elapsedTimeMs)}\` working on: *${take.description}*`,
						},
					},
					{
						type: "divider",
					},
					{
						type: "video",
						video_url: `${process.env.API_URL}/api/video/${take.id}`,
						title_url: `${process.env.API_URL}/api/video/${take.id}`,
						title: {
							type: "plain_text",
							text: `takes from ${takeUploadedAt?.toLocaleString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}`,
						},
						thumbnail_url: `https://cachet.dunkirk.sh/users/${payload.user}/r`,
						alt_text: `takes from ${takeUploadedAt?.toLocaleString("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} uploaded with the description: *${take.description}*`,
					},
					{
						type: "divider",
					},
					{
						type: "actions",
						elements: [
							{
								type: "static_select",
								placeholder: {
									type: "plain_text",
									text: "Select multiplier",
								},
								options: [
									{
										text: {
											type: "plain_text",
											text: "0.5x",
										},
										value: "0.5",
									},
									{
										text: {
											type: "plain_text",
											text: "1x",
										},
										value: "1",
									},
									{
										text: {
											type: "plain_text",
											text: "1.25x",
										},
										value: "1.25",
									},
									{
										text: {
											type: "plain_text",
											text: "1.5x",
										},
										value: "1.5",
									},
									{
										text: {
											type: "plain_text",
											text: "2x",
										},
										value: "2",
									},
									{
										text: {
											type: "plain_text",
											text: "3x",
										},
										value: "2.5",
									},
								],
								action_id: "select_multiplier",
							},
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "approve",
								},
								style: "primary",
								value: take.id,
								action_id: "approve",
							},
							{
								type: "button",
								text: {
									type: "plain_text",
									text: "reject",
								},
								style: "danger",
								value: take.id,
								action_id: "reject",
							},
						],
					},
					{
						type: "divider",
					},
					{
						type: "context",
						elements: [
							{
								type: "mrkdwn",
								text: `take by <@${user}> for \`${prettyPrintTime(take.elapsedTimeMs)}\` working on: *${take.description}*`,
							},
						],
					},
				],
			});
		} catch (error) {
			console.error("Error handling file message:", error);
			await slackClient.chat.postMessage({
				channel: payload.channel,
				thread_ts: payload.thread_ts,
				text: ":warning: there was an error processing your upload",
			});

			Sentry.captureException(error, {
				extra: {
					channel: payload.channel,
					user: payload.user,
					thread_ts: payload.thread_ts,
				},
				tags: {
					type: "file_upload_error",
				},
			});
		}
	});

	slackApp.action("select_multiplier", async () => {});

	slackApp.action("approve", async ({ payload, context }) => {
		try {
			const multiplier = Object.values(payload.state.values)[0]
				?.select_multiplier?.selected_option?.value;
			// @ts-expect-error
			const takeId = payload.actions[0]?.value;

			const take = await db
				.select()
				.from(takesTable)
				.where(eq(takesTable.id, takeId));
			if (take.length === 0) {
				return;
			}
			const takeToApprove = take[0];
			if (!takeToApprove) return;

			await db
				.update(takesTable)
				.set({
					status: "approved",
					multiplier: multiplier,
				})
				.where(eq(takesTable.id, takeId));

			await slackClient.chat.postMessage({
				channel: payload.user.id,
				thread_ts: take[0]?.ts as string,
				text: `take approved with multiplier \`${multiplier}\` so you have earned *${Number((takeToApprove.elapsedTimeMs * Number(multiplier)) / 1000 / 60).toFixed(1)} takes*!`,
			});

			// delete the message from the review channel
			if (context.respond)
				await context.respond({
					delete_original: true,
				});
		} catch (error) {
			console.error("Error approving take:", error);

			await slackClient.chat.postEphemeral({
				channel: process.env.SLACK_REVIEW_CHANNEL || "",
				user: payload.user.id,
				text: ":warning: there was an error approving the take",
			});

			Sentry.captureException(error, {
				extra: {
					// @ts-expect-error
					take: payload.actions[0]?.value,
					userApproving: payload.user,
				},
				tags: {
					type: "take_approve_error",
				},
			});
		}
	});

	slackApp.action("reject", async ({ payload, context }) => {
		try {
			// @ts-expect-error
			const takeId = payload.actions[0]?.value;

			const take = await db
				.select()
				.from(takesTable)
				.where(eq(takesTable.id, takeId));
			if (take.length === 0) {
				return;
			}
			await db
				.update(takesTable)
				.set({
					status: "rejected",
					multiplier: "0",
				})
				.where(eq(takesTable.id, takeId));

			await slackClient.chat.postMessage({
				channel: payload.user.id,
				thread_ts: take[0]?.ts as string,
				text: "take rejected :(",
			});

			// delete the message from the review channel
			if (context.respond)
				await context.respond({
					delete_original: true,
				});
		} catch (error) {
			console.error("Error rejecting take:", error);

			await slackClient.chat.postEphemeral({
				channel: process.env.SLACK_REVIEW_CHANNEL || "",
				user: payload.user.id,
				text: ":warning: there was an error rejecting the take",
			});

			Sentry.captureException(error, {
				extra: {
					// @ts-expect-error
					take: payload.actions[0]?.value,
					userRejecting: payload.user,
				},
				tags: {
					type: "take_reject_error",
				},
			});
		}
	});
}
