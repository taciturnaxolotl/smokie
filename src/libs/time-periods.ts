import type { PeriodType, TimePeriod } from "../features/takes/types";
import TakesConfig from "./config";

export function calculateElapsedTime(periods: TimePeriod[]): number {
	return Math.min(
		periods.reduce((total, period) => {
			if (period.type !== "active") return total;

			const endTime = period.endTime || Date.now();
			return total + (endTime - period.startTime);
		}, 0),
		TakesConfig.DEFAULT_SESSION_LENGTH * 60 * 1000,
	);
}

export function addNewPeriod(
	periodsString: string,
	type: PeriodType,
): TimePeriod[] {
	const periods = JSON.parse(periodsString);

	// Close previous period if exists
	if (periods.length > 0) {
		const lastPeriod = periods[periods.length - 1];
		if (!lastPeriod.endTime) {
			lastPeriod.endTime = Date.now();
		}
	}

	// Add new period
	periods.push({
		type,
		startTime: Date.now(),
		endTime: null,
	});

	return periods;
}

export function getRemainingTime(
	targetDurationMs: number,
	periods: string,
): {
	remaining: number;
	endTime: Date;
} {
	const elapsedMs = calculateElapsedTime(JSON.parse(periods));
	const remaining = Math.max(0, targetDurationMs - elapsedMs);
	const endTime = new Date(Date.now() + remaining);
	return { remaining, endTime };
}

export function getPausedTimeRemaining(periods: string): number {
	const parsedPeriods = JSON.parse(periods);
	const currentPeriod = parsedPeriods[parsedPeriods.length - 1];

	if (currentPeriod.type !== "paused" || !currentPeriod.startTime) {
		return 0;
	}

	const now = new Date();
	const pausedDuration = now.getTime() - currentPeriod.startTime;

	return Math.max(
		0,
		TakesConfig.MAX_PAUSE_DURATION * 60 * 1000 - pausedDuration,
	);
}

export function getPausedDuration(periods: string): number {
	const parsedPeriods = JSON.parse(periods);
	return parsedPeriods.reduce((total: number, period: TimePeriod) => {
		if (period.type !== "paused") return total;

		const endTime = period.endTime || Date.now();
		return total + (endTime - period.startTime);
	}, 0);
}
