import TakesConfig from "../../../libs/config";
import {
	checkActiveSessions,
	expirePausedSessions,
} from "../services/notifications";

export default function setupNotifications() {
	const notificationInterval = TakesConfig.NOTIFICATIONS.CHECK_INTERVAL;
	setInterval(async () => {
		await checkActiveSessions();
		await expirePausedSessions();
	}, notificationInterval);
}
