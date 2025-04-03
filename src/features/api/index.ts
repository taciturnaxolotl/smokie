import recentTakes from "./routes/recentTakes";
import video from "./routes/video";

export { default as video } from "./routes/video";

export async function apiRouter(url: URL) {
	const path = url.pathname.split("/")[2];

	console.log(`API path: ${path}`);

	switch (path) {
		case "video":
			return video(url);
		case "recentTakes":
			return recentTakes();
		default:
			return new Response("404 Not Found", { status: 404 });
	}
}
