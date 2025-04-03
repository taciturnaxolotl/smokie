import * as Sentry from "@sentry/bun";
import TakesConfig from "../../../libs/config";
import { blog } from "../../../libs/Logger";
import {
	checkActiveSessions,
	expirePausedSessions,
} from "../services/notifications";

export default function setupNotifications() {
	try {
		const notificationInterval = TakesConfig.NOTIFICATIONS.CHECK_INTERVAL;

		setInterval(async () => {
			try {
				await checkActiveSessions();
				await expirePausedSessions();
			} catch (error) {
				if (error instanceof Error)
					blog(
						`Error in notifications check: ${error.message}`,
						"error",
					);
				Sentry.captureException(error, {
					extra: {
						context: "notifications check",
						checkInterval: notificationInterval,
					},
					tags: {
						type: "notification_check",
					},
				});
			}
		}, notificationInterval);
	} catch (error) {
		if (error instanceof Error)
			blog(`Error setting up notifications: ${error.message}`, "error");
		Sentry.captureException(error, {
			extra: {
				context: "notifications setup",
			},
			tags: {
				type: "notification_setup",
			},
		});
		throw error; // Re-throw to prevent the app from starting with broken notifications
	}
}
