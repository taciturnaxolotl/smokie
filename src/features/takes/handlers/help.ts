import type { MessageResponse } from "../types";

export default async function handleHelp(): Promise<MessageResponse> {
	return {
		text: "*Takes Commands*\n\n• `/takes history` - View your past takes sessions",
		response_type: "ephemeral",
		blocks: [
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "*Takes Commands*",
				},
			},
			{
				type: "section",
				text: {
					type: "mrkdwn",
					text: "• `/takes history` - View your past takes sessions",
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🏡 Home",
							emoji: true,
						},
						value: "status",
						action_id: "takes_home",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "📋 History",
							emoji: true,
						},
						value: "history",
						action_id: "takes_history",
					},
				],
			},
		],
	};
}
