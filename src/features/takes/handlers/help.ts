import TakesConfig from "../../../libs/config";
import type { MessageResponse } from "../types";

export default async function handleHelp(): Promise<MessageResponse> {
	return {
		text: `*Takes Commands*\n\n• \`/takes start [minutes]\` - Start a new takes session, optionally specifying duration\n• \`/takes pause\` - Pause your current session (max ${TakesConfig.MAX_PAUSE_DURATION} min)\n• \`/takes resume\` - Resume your paused session\n• \`/takes stop [notes]\` - End your current session with optional notes\n• \`/takes status\` - Check the status of your session\n• \`/takes history\` - View your past takes sessions`,
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
					text: `• \`/takes start [minutes]\` - Start a new session (default: ${TakesConfig.DEFAULT_SESSION_LENGTH} min)\n• \`/takes pause\` - Pause your session (max ${TakesConfig.MAX_PAUSE_DURATION} min)\n• \`/takes resume\` - Resume your paused session\n• \`/takes stop [notes]\` - End session with optional notes\n• \`/takes status\` - Check status\n• \`/takes history\` - View past sessions`,
				},
			},
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🎬 Start New Session",
							emoji: true,
						},
						value: "start",
						action_id: "takes_start",
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
