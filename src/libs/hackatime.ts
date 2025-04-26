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
		name: "Hackatime V2 (broken don't use)",
		apiUrl: "https://waka.hackclub.com/api",
	},
} as const;

export type HackatimeVersion = keyof typeof HACKATIME_VERSIONS;

/**
 * Converts a Hackatime version identifier to its full API URL
 * @param version The version identifier (v1 or v2 soon)
 * @returns The corresponding API URL
 */
export function getHackatimeApiUrl(version: HackatimeVersion): string {
	return HACKATIME_VERSIONS[version].apiUrl;
}

/**
 * Gets the fancy name for a Hackatime version
 * @param version The version identifier (v1 or v2 soon)
 * @returns The fancy display name for the version
 */
export function getHackatimeName(version: HackatimeVersion): string {
	return HACKATIME_VERSIONS[version].name;
}

/**
 * Determines which Hackatime version is being used based on the API URL
 * @param apiUrl The full Hackatime API URL
 * @returns The version identifier (v1 or v2 soon), defaulting to v1 if not recognized
 */
export function getHackatimeVersion(apiUrl: string): HackatimeVersion {
	for (const [version, data] of Object.entries(HACKATIME_VERSIONS)) {
		if (apiUrl === data.apiUrl) {
			return version as HackatimeVersion;
		}
	}
	return "v1";
}

/**
 * Type definition for Hackatime summary response
 */
export interface HackatimeSummaryResponse {
	categories?: Array<{
		name: string;
		total: number;
		percent?: number;
	}>;
	projects?: Array<{
		key: string;
		name: string;
		total: number;
		percent?: number;
		last_used_at: string;
	}>;
	languages?: Array<{
		name: string;
		total: number;
		percent?: number;
	}>;
	editors?: Array<{
		name: string;
		total: number;
		percent?: number;
	}>;
	operating_systems?: Array<{
		name: string;
		total: number;
		percent?: number;
	}>;
	range?: {
		start: string;
		end: string;
		timezone: string;
	};
	total_categories_sum?: number;
	total_categories_human_readable?: string;
	projectsKeys?: string[];
}

/**
 * Fetches a user's Hackatime summary
 * @param userId The user ID to fetch the summary for
 * @param version The Hackatime version to use (defaults to v1)
 * @param projectKeys Optional array of project keys to filter results by
 * @param from Optional start date for the summary
 * @param to Optional end date for the summary
 * @returns A promise that resolves to the summary data
 */
export async function fetchHackatimeSummary(
	userId: string,
	version: HackatimeVersion = "v1",
	projectKeys?: string[],
	from?: Date,
	to?: Date,
): Promise<HackatimeSummaryResponse> {
	const apiUrl = getHackatimeApiUrl(version);
	const params = new URLSearchParams({
		user: userId,
	});
	if (!from || !to) {
		params.append("interval", "month");
	} else if (from && to) {
		params.append("from", from.toISOString());
		params.append("to", to.toISOString());
	}

	const response = await fetch(`${apiUrl}/summary?${params.toString()}`, {
		headers: {
			accept: "application/json",
			Authorization: "Bearer 2ce9e698-8a16-46f0-b49a-ac121bcfd608",
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			// Return blank info for 401 Unauthorized errors
			return {
				categories: [],
				projects: [],
				languages: [],
				editors: [],
				operating_systems: [],
				total_categories_sum: 0,
				total_categories_human_readable: "0h 0m 0s",
				projectsKeys: [],
			};
		}
		throw new Error(
			`Failed to fetch Hackatime summary: ${response.status} ${response.statusText}: ${await response.text()}`,
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

/**
 * Fetches the most recent project keys from a user's Hackatime data
 * @param userId The user ID to fetch the project keys for
 * @param limit The maximum number of projects to return (defaults to 10)
 * @param version The Hackatime version to use (defaults to v1)
 * @returns A promise that resolves to an array of recent project keys
 */
export async function fetchRecentProjectKeys(
	userId: string,
	limit = 10,
	version: HackatimeVersion = "v1",
): Promise<string[]> {
	const summary = await fetchHackatimeSummary(userId, version);

	// Extract projects and sort by most recent
	const sortedProjects =
		summary.projects?.sort(
			(a: { last_used_at: string }, b: { last_used_at: string }) =>
				new Date(b.last_used_at).getTime() -
				new Date(a.last_used_at).getTime(),
		) || [];

	// Return the keys of the most recent projects up to the limit
	return sortedProjects
		.slice(0, limit)
		.map((project: { key: string }) => project.key);
}
