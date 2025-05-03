export async function fetchUserData(userId: string) {
	const res = await fetch(`https://cachet.dunkirk.sh/users/${userId}/`);
	const json = await res.json();

	return {
		id: json.id,
		expiration: json.expiration,
		user: json.user,
		displayName: json.displayName,
		image: json.image,
	};
}

export const userService = {
	cache: {} as Record<string, { name: string; timestamp: number }>,
	pendingRequests: {} as Record<string, Promise<string>>,
	CACHE_TTL: 5 * 60 * 1000,

	async getUserName(userId: string): Promise<string> {
		const now = Date.now();

		// Check if user data is in cache and still valid
		if (
			this.cache[userId] &&
			now - this.cache[userId].timestamp < this.CACHE_TTL
		) {
			return this.cache[userId].name;
		}

		// If there's already a pending request for this user, return that promise
		// instead of creating a new request
		if (this.pendingRequests[userId]) {
			return this.pendingRequests[userId];
		}

		// Create a new promise for this user and store it
		const fetchPromise = (async () => {
			try {
				const userData = await fetchUserData(userId);
				const userName = userData?.displayName || "Unknown User";

				this.cache[userId] = {
					name: userName,
					timestamp: now,
				};

				return userName;
			} catch (error) {
				console.error("Error fetching user data:", error);
				return "Unknown User";
			} finally {
				// Clean up the pending request when done
				delete this.pendingRequests[userId];
			}
		})();

		// Store the promise
		this.pendingRequests[userId] = fetchPromise;

		// Return the promise
		return fetchPromise;
	},
};
