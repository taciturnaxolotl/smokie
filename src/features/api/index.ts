import { recentTakes } from "./routes/recentTakes";
import video from "./routes/video";
import { handleApiError } from "../../libs/apiError";

export { default as video } from "./routes/video";

export async function apiRouter(url: URL) {
	try {
		const path = url.pathname.split("/")[2];

		switch (path) {
			case "video":
				return await video(url);
			case "recentTakes":
				return await recentTakes(url);
			default:
				return new Response(
					JSON.stringify({ error: "Route not found" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
		}
	} catch (error) {
		return handleApiError(error, "apiRouter");
	}
}
