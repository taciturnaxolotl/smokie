// Helper function for pretty-printing time
export const prettyPrintTime = (ms: number): string => {
	const minutes = Math.round(ms / 60000);
	if (minutes < 2) {
		const seconds = Math.max(0, Math.round(ms / 1000));
		return `${seconds} seconds`;
	}
	return `${minutes} minutes`;
};

// Helper function that generates the slack date format
export const generateSlackDate = (endTime: Date): string => {
	return `<!date^${Math.floor(endTime.getTime() / 1000)}^{time}|${endTime.toLocaleTimeString()}>`;
};
