import type { AnyMessageBlock } from "slack-edge";

export type MessageResponse = {
	blocks?: AnyMessageBlock[];
	text: string;
	response_type: "ephemeral" | "in_channel";
};
