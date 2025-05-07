import { recentTakes } from "./routes/recentTakes";
import video from "./routes/video";
import { handleApiError } from "../../libs/apiError";
import { projects } from "./routes/projects";
import { time } from "./routes/time";

export { default as video } from "./routes/video";

export async function apiRouter(url: URL) {
	try {
		const path = url.pathname.split("/")[2];

		switch (path) {
			case "video":
				return await video(url);
			case "recentTakes":
				return await recentTakes(url);
			case "projects":
				return await projects(url);
			case "time":
				return await time(url);
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
