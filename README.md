# The Takes Project

<img src="https://raw.githubusercontent.com/taciturnaxolotl/takes/main/.github/images/smokie.svg" height="175" align="right" alt="smokie the bear">

> ### More deets coming soon 👀 🏔️ 📹  
> A slack bot that tracks takes and accepts uploads; developed with 💖 @ [Hack Club](https://github.com/hackclub)  
>  
> ⚠️ **Highly opinionated slack bot warning** - Project rapidly iterating

## 🚧 Dev

You can launch the bot locally with bun

```bash
bun install
bun dev
```

you will also need to launch an ngrok tunnel and update your dev slack manifest to point to the ngrok tunnel

```bash
bun ngrok
```

you also need to create a `.env` file with the following keys

```bash
SLACK_BOT_TOKEN="xoxb-xxxxx-xxxxx-xxxxx-xxxxx"
SLACK_SIGNING_SECRET="xxxxx"
SLACK_SPAM_CHANNEL="C069N64PW4A"
SLACK_LOG_CHANNEL="C08KX2YNN87"
SLACK_REVIEW_CHANNEL="C07P0CXT08H"
SLACK_LISTEN_CHANNEL="C08NEE6FVJT"
NODE_ENV="dev"
SLACK_USER_TOKEN="xoxp-xxxxx-xxxxx-xxxxx-xxxxx"
API_URL="https://casual-renewing-reptile.ngrok-free.app"
SENTRY_DSN="https://xxxxxx@xxxxxx.ingest.us.sentry.io/xxxx"
DATABASE_URL="postgres://username:password@host:5432/smokie"
CDN_TOKEN="cdn_token"
```

## 🔌 API Docs

all endpoints are prefixed with `/api` and return JSON unless specified otherwise

```
GET /api/video?media=<url>
```
returns an HTML page with a video player for the given media URL

```
GET /api/recentTakes?user=<userId>
```
returns recent takes, optionally filtered by user ID
- if user not found, returns `404` with an empty takes array
- returns up to 40 takes ordered by creation date (newest first)
- includes project info and total time stats
- includes userName for each take

```
GET /api/projects?user=<userId>
```
returns project info
- with user param: returns a single project for that user
- without user param: returns all projects
- returns empty array if no projects found
- includes userName for each project

```
GET /api/time?user=<userId>
```
returns the total time spent on takes for a user and daily time statistics
- requires userId parameter
- returns 400 if userId is missing
- returns 404 if user not found
- includes totalTakesTime (in seconds) and dailyStats showing time logged per day

typical take object looks like:
```ts
{
  id: string;
  userId: string;
  notes: string;
  createdAt: Date;
  mediaUrls: string[];
  elapsedTime: number; // seconds
  project: string;
  totalTakesTime: number; // seconds
  userName: string;
}
```

typical project object looks like:
```ts
{
  projectName: string;
  projectDescription: string;
  projectBannerUrl: string;
  totalTakesTime: number; // seconds
  userId: string;
  userName: string;
  takesCount: number;
}
```

## 📜 License

The code is licensed under `MIT`! That means MIT allows for free use, modification, and distribution of the software, requiring only that the original copyright notice and disclaimer are included in copies. All artwork and images are copyright reserved but may be used with proper attribution to the authors.

<p align="center">
	<img src="https://raw.githubusercontent.com/taciturnaxolotl/carriage/master/.github/images/line-break.svg" />
</p>

<p align="center">
	<i><code>&copy 2025-present <a href="https://github.com/taciturnaxolotl">Kieran Klukas</a></code></i>
</p>

<p align="center">
	<a href="https://github.com/taciturnaxolotl/takes/blob/master/LICENSE.md"><img src="https://img.shields.io/static/v1.svg?style=for-the-badge&label=License&message=MIT&logoColor=d9e0ee&colorA=363a4f&colorB=b7bdf8"/></a>
</p>
