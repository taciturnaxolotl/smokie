// Configuration defaults and constants for the takes application

export const TakesConfig = {
	// Default takes session length in minutes (should be 90 for production)
	DEFAULT_SESSION_LENGTH: 2,

	// Maximum time in minutes that a takes session can be paused before automatic expiration
	MAX_PAUSE_DURATION: 3,

	// Maximum number of past takes to display in history
	MAX_HISTORY_ITEMS: 5,

	// Time thresholds for notifications (in minutes)
	NOTIFICATIONS: {
		// When to send a warning about low time remaining (minutes)
		LOW_TIME_WARNING: 2,

		// When to send a warning about pause expiration (minutes)
		PAUSE_EXPIRATION_WARNING: 5,

		// Frequency to check for notifications (milliseconds)
		CHECK_INTERVAL: 5 * 1000, // Every minute
	},

	// Modal settings
	MODAL: {
		// Maximum length for take description
		MAX_DESCRIPTION_LENGTH: 100,
	},
};

export default TakesConfig;
