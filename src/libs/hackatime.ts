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

/**
 * Fetches a user's Hackatime summary
 * @param userId The user ID to fetch the summary for
 * @param version The Hackatime version to use (defaults to v2)
 * @param projectKeys Optional array of project keys to filter results by
 * @returns A promise that resolves to the summary data
 */
export async function fetchHackatimeSummary(
	userId: string,
	version: HackatimeVersion = "v2",
	projectKeys?: string[],
) {
	const apiUrl = getHackatimeApiUrl(version);
	const response = await fetch(
		`${apiUrl}/summary?user=${userId}&interval=month`,
		{
			headers: {
				accept: "application/json",
				Authorization: "Bearer 2ce9e698-8a16-46f0-b49a-ac121bcfd608",
			},
		},
	);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch Hackatime summary: ${response.status} ${response.statusText}`,
		);
	}

	const data = await response.json();

	// Add derived properties similar to the shell command
	const totalCategoriesSum =
		data.categories?.reduce(
			(sum: number, category: { total: number }) => sum + category.total,
			0,
		) || 0;
	const hours = Math.floor(totalCategoriesSum / 3600);
	const minutes = Math.floor((totalCategoriesSum % 3600) / 60);
	const seconds = totalCategoriesSum % 60;

	// Get all project keys from the data
	const allProjectsKeys =
		data.projects
			?.sort(
				(a: { total: number }, b: { total: number }) =>
					b.total - a.total,
			)
			.map((project: { key: string }) => project.key) || [];

	// Filter by provided project keys if any
	const projectsKeys = projectKeys
		? allProjectsKeys.filter((key: string) => projectKeys.includes(key))
		: allProjectsKeys;

	return {
		...data,
		total_categories_sum: totalCategoriesSum,
		total_categories_human_readable: `${hours}h ${minutes}m ${seconds}s`,
		projectsKeys: projectsKeys,
	};
}
