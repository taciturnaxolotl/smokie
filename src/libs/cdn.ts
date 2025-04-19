export type DeployedFile = {
	deployedUrl: string;
	file: string;
	sha: string;
	size: number;
};

export type DeployResponse = {
	files: DeployedFile[];
	cdnBase: string;
};

/**
 * Deploys files to the Hack Club CDN
 * @param fileUrls Array of URLs to deploy
 * @param token Authorization token
 * @param downloadToken Download authorization token
 * @returns Promise that resolves to the deployment response
 */
export async function deployToHackClubCDN(
	fileUrls: string[],
): Promise<DeployResponse> {
	const response = await fetch("https://cdn.hackclub.com/api/v3/new", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${process.env.CDN_TOKEN}`,
			"X-Download-Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(fileUrls),
	});

	if (!response.ok) {
		throw new Error(`Failed to deploy files: ${response.statusText}`);
	}

	return response.json();
}
