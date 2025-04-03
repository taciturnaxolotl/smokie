import { handleApiError } from "../../../libs/apiError";
import { db } from "../../../libs/db";
import { takes as takesTable } from "../../../libs/schema";
import { eq, and } from "drizzle-orm";

export default async function getVideo(url: URL): Promise<Response> {
	try {
		const videoId = url.pathname.split("/")[2];
		const thumbnail = url.pathname.split("/")[3] === "thumbnail";

		if (!videoId) {
			return new Response(JSON.stringify({ error: "Invalid video id" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		const video = await db
			.select()
			.from(takesTable)
			.where(eq(takesTable.id, videoId));

		if (video.length === 0) {
			return new Response(JSON.stringify({ error: "Video not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const videoData = video[0];

		if (thumbnail) {
			return Response.redirect(
				`https://cachet.dunkirk.sh/users/${videoData?.userId}/r`,
			);
		}

		return new Response(
			`<!DOCTYPE html>
        <html>
        <head>
        <title>Video Player</title>
        <style>
            body, html {
                margin: 0;
                padding: 0;
                height: 100vh;
                overflow: hidden;
            }
            .video-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                background: linear-gradient(180deg, #000000 25%, #ffffff 50%, #000000 75%);
            }
            video {
                width: 100vw;
                height: 100vh;
                object-fit: contain;
                position: absolute;
                bottom: 0;
            }
        </style>
        </head>
        <body>
        <div class="video-container">
            <video autoplay controls>
                <source src="${videoData?.takeUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        </div>
        </body>
        </html>`,
			{
				headers: {
					"Content-Type": "text/html",
				},
			},
		);
	} catch (error) {
		return handleApiError(error, "getVideo");
	}
}
