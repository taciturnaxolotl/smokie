import type { AnyMessageBlock } from "slack-edge";

export type MessageResponse = {
	blocks?: AnyMessageBlock[];
	text: string;
	response_type: "ephemeral" | "in_channel";
};

export type PeriodType = "active" | "paused";

export interface TimePeriod {
	type: PeriodType;
	startTime: number; // timestamp
	endTime: number | null; // null means ongoing
}

export interface TakeTimeTracking {
	periods: TimePeriod[];
	elapsedTimeMs: number;
	targetDurationMs: number;
}

export interface TakeTimeTrackingString {
	periods: string;
	elapsedTimeMs: number;
	targetDurationMs: number;
}
