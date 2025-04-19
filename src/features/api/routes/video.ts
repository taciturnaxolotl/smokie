import { handleApiError } from "../../../libs/apiError";

export default async function getVideo(url: URL): Promise<Response> {
	try {
		const params = new URLSearchParams(url.search);
		const mediaSource = params.get("media");

		if (!mediaSource) {
			return new Response(
				JSON.stringify({ error: "No media source provided" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
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
    						<source src="${mediaSource}" type="video/mp4">
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
