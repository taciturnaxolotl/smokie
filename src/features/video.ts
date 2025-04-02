import { db } from "../libs/db";
import { takes as takesTable } from "../libs/schema";
import { eq, and } from "drizzle-orm";

export async function getVideo(url: URL): Promise<Response> {
	const videoId = url.pathname.split("/")[2];

	if (!videoId) {
		return new Response("Invalid video id", { status: 400 });
	}

	const video = await db
		.select()
		.from(takesTable)
		.where(eq(takesTable.id, videoId));

	if (video.length === 0) {
		return new Response("Video not found", { status: 404 });
	}

	const videoData = video[0];

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
}
