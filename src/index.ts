import { SlackApp } from "slack-edge";

import { takes } from "./features/index";

import { t } from "./libs/template";
import { blog } from "./libs/Logger";
import { version, name } from "../package.json";
import { apiRouter, video } from "./features/api";
const environment = process.env.NODE_ENV;

import * as Sentry from "@sentry/bun";

// Check required environment variables
const requiredVars = [
	"SLACK_BOT_TOKEN",
	"SLACK_SIGNING_SECRET",
	"SLACK_REVIEW_CHANNEL",
	"SLACK_LOG_CHANNEL",
	"SLACK_SPAM_CHANNEL",
	"SLACK_USER_TOKEN",
	"API_URL",
	"SENTRY_DSN",
] as const;
const missingVars = requiredVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
	throw new Error(
		`Missing required environment variables: ${missingVars.join(", ")}`,
	);
}

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment,
	release: version,
});

console.log(
	`----------------------------------\n${name} Server\n----------------------------------\n`,
);
console.log(`🏗️ Starting ${name}...`);
console.log("📦 Loading Slack App...");
console.log("🔑 Loading environment variables...");

const slackApp = new SlackApp({
	env: {
		SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN as string,
		SLACK_SIGNING_SECRET: process.env.SLACK_SIGNING_SECRET as string,
		SLACK_LOGGING_LEVEL: "INFO",
	},
	startLazyListenerAfterAck: true,
});
const slackClient = slackApp.client;

takes();

export default {
	port: process.env.PORT || 3000,
	development: environment === "dev",
	async fetch(request: Request) {
		const url = new URL(request.url);
		const path = url.pathname.split("/").filter(Boolean)[0]
			? `/${url.pathname.split("/").filter(Boolean)[0]}`
			: "/";

		switch (path) {
			case "/":
				return new Response(`Hello World from ${name}@${version}`);
			case "/health":
				return new Response("OK");
			case "/slack":
				return slackApp.run(request);
			case "/api":
				return apiRouter(url);
			default:
				return new Response("404 Not Found", { status: 404 });
		}
	},
};

console.log(
	`🚀 Server Started in ${
		Bun.nanoseconds() / 1000000
	} milliseconds on version: ${version}!\n\n----------------------------------\n`,
);

blog(
	t("app.startup", {
		environment,
	}),
	"start",
	{
		channel: process.env.SLACK_SPAM_CHANNEL || "",
	},
);

console.log("\n----------------------------------\n");

export { slackApp, slackClient, version, name, environment };
