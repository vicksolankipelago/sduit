# SDUI Journey Builder

Server-Driven UI Journey Builder for designing and testing voice agent experiences.

## Project Structure

```
sduit/
├── apps/
│   ├── web/          # React/Vite frontend (port 5173)
│   └── api/          # Express.js backend (port 3001)
├── packages/
│   └── shared/       # Shared utilities (auth, types)
├── assets/
│   ├── animations/   # Lottie JSON animations
│   ├── fonts/        # Pelago design system fonts
│   └── prompts/      # Voice agent prompt templates
└── scripts/          # Utility scripts
```

## Development

```bash
npm run dev        # Start both web and API servers
npm run dev:web    # Start web only
npm run dev:api    # Start API only
```

## Environment Files

- `apps/web/.env` - Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- `apps/api/.env` - Azure OpenAI and AWS Bedrock credentials

## Commit Convention

This project uses JIRA ticket-based commits:

```
[POLICE-XXX] type: description
```

Use `/commit` skill to create properly formatted commits.

## Skills

- `/commit` - Create a JIRA-formatted git commit
