// Configuration defaults and constants for the takes application

export const TakesConfig = {
	// Default takes session length in minutes (should be 90 for production)
	DEFAULT_SESSION_LENGTH: 90,

	// Maximum time in minutes that a takes session can be paused before automatic expiration
	MAX_PAUSE_DURATION: 45,

	// Maximum number of past takes to display in history
	MAX_HISTORY_ITEMS: 7,

	// Time thresholds for notifications (in minutes)
	NOTIFICATIONS: {
		// When to send a warning about low time remaining (minutes)
		LOW_TIME_WARNING: 5,

		// When to send a warning about pause expiration (minutes)
		PAUSE_EXPIRATION_WARNING: 5,

		// Frequency to check for notifications (milliseconds)
		CHECK_INTERVAL: 10 * 1000, // Every 10 seconds
	},
};

export default TakesConfig;
