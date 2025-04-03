import * as Sentry from "@sentry/bun";

export interface ApiError {
	message: string;
	status: number;
}

export function handleApiError(error: unknown, context: string): Response {
	if (error instanceof Error) {
		Sentry.captureException(error, {
			extra: { context },
			tags: { type: "api_error" },
		});

		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(
		JSON.stringify({ error: "An unexpected error occurred" }),
		{
			status: 500,
			headers: { "Content-Type": "application/json" },
		},
	);
}
