import type { AnyMessageBlock } from "slack-edge";
import type { MessageResponse } from "../types";

export function getDescriptionBlocks(error?: string): MessageResponse {
	const blocks: AnyMessageBlock[] = [
		{
			type: "input",
			block_id: "note_block",
			element: {
				type: "plain_text_input",
				action_id: "note_input",
				placeholder: {
					type: "plain_text",
					text: "Enter a note for your session",
				},
				multiline: true,
			},
			label: {
				type: "plain_text",
				text: "Note",
			},
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "🎬 Start Session",
						emoji: true,
					},
					value: "start",
					action_id: "takes_start",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "⛔ Cancel",
						emoji: true,
					},
					value: "cancel",
					action_id: "takes_status",
					style: "danger",
				},
			],
		},
	];

	if (error) {
		blocks.push(
			{
				type: "divider",
			},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `⚠️ ${error}`,
					},
				],
			},
		);
	}

	return {
		text: "Please enter a note for your session:",
		response_type: "ephemeral",
		blocks,
	};
}

export function getEditDescriptionBlocks(
	description: string,
	error?: string,
): MessageResponse {
	const blocks: AnyMessageBlock[] = [
		{
			type: "input",
			block_id: "note_block",
			element: {
				type: "plain_text_input",
				action_id: "note_input",
				placeholder: {
					type: "plain_text",
					text: "Enter a note for your session",
				},
				multiline: true,
				initial_value: description,
			},
			label: {
				type: "plain_text",
				text: "Note",
			},
		},
		{
			type: "actions",
			elements: [
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "✍️ Update Note",
						emoji: true,
					},
					value: "start",
					action_id: "takes_edit",
				},
				{
					type: "button",
					text: {
						type: "plain_text",
						text: "⛔ Cancel",
						emoji: true,
					},
					value: "cancel",
					action_id: "takes_status",
					style: "danger",
				},
			],
		},
	];

	if (error) {
		blocks.push(
			{
				type: "divider",
			},
			{
				type: "context",
				elements: [
					{
						type: "mrkdwn",
						text: `⚠️ ${error}`,
					},
				],
			},
		);
	}

	return {
		text: "Please enter a note for your session:",
		response_type: "ephemeral",
		blocks,
	};
}
