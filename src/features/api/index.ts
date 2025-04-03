import { recentTakes, takesPerUser } from "./routes/recentTakes";
import video from "./routes/video";

export { default as video } from "./routes/video";

export async function apiRouter(url: URL) {
	const path = url.pathname.split("/")[2];

	switch (path) {
		case "video":
			return video(url);
		case "recentTakes":
			return recentTakes();
		case "takesPerUser":
			return takesPerUser(url.pathname.split("/")[3] as string);
		default:
			return new Response("404 Not Found", { status: 404 });
	}
}
