# Development Guide for Takes

## Commands
- `bun run dev` - Start development server with watch mode
- `bun run db:generate` - Generate database migrations with Drizzle
- `bun run db:migrate` - Apply database migrations
- `bun run db:studio` - Start Drizzle Studio on port 3001
- `npx biome lint .` - Lint codebase
- `npx biome format . --write` - Format codebase

## Code Style
- **Formatting**: Use tabs for indentation, double quotes for strings (enforced by Biome)
- **Imports**: Organize imports automatically with Biome
- **Types**: Use TypeScript with strict mode enabled; prefer explicit return types
- **Error Handling**: Use try/catch blocks with specific error types when possible
- **Naming**: 
  - camelCase for variables and functions
  - PascalCase for classes and types
  - ALL_CAPS for constants
- **Database**: Use Drizzle ORM with SQLite
- **API**: Use Slack Edge API for bot interactions
- Always do await context.respond and then return rather than returning the function
- Always use Bun APIs when available as they're faster (e.g. `bun.randomUUID7()` instead of `crypto.uuid`)

## Architecture
Slackbot that uses a SQLite database through Drizzle ORM to manage "takes" sessions.
Keep feature implementations in the `src/features` directory and common utilities in `src/libs`.