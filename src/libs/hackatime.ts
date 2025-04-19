/**
 * Maps Hackatime version identifiers to their corresponding data
 */
export const HACKATIME_VERSIONS = {
	v1: {
		id: "v1",
		name: "Hackatime",
		apiUrl: "https://waka.hackclub.com/api",
	},
	v2: {
		id: "v2",
		name: "Hackatime v2",
		apiUrl: "https://hackatime.hackclub.com/api",
	},
} as const;

export type HackatimeVersion = keyof typeof HACKATIME_VERSIONS;

/**
 * Converts a Hackatime version identifier to its full API URL
 * @param version The version identifier (v1 or v2)
 * @returns The corresponding API URL
 */
export function getHackatimeApiUrl(version: HackatimeVersion): string {
	return HACKATIME_VERSIONS[version].apiUrl;
}

/**
 * Gets the fancy name for a Hackatime version
 * @param version The version identifier (v1 or v2)
 * @returns The fancy display name for the version
 */
export function getHackatimeName(version: HackatimeVersion): string {
	return HACKATIME_VERSIONS[version].name;
}

/**
 * Determines which Hackatime version is being used based on the API URL
 * @param apiUrl The full Hackatime API URL
 * @returns The version identifier (v1 or v2), defaulting to v2 if not recognized
 */
export function getHackatimeVersion(apiUrl: string): HackatimeVersion {
	for (const [version, data] of Object.entries(HACKATIME_VERSIONS)) {
		if (apiUrl === data.apiUrl) {
			return version as HackatimeVersion;
		}
	}
	return "v2";
}
