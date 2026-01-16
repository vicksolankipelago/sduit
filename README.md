# SDUI Journey Builder

A Server-Driven UI Journey Builder for designing and testing voice agent experiences with real-time AI capabilities.

## Features

- **Voice Agent** - Real-time voice conversations powered by Azure OpenAI WebRTC
- **Journey Builder** - Visual canvas for creating and editing SDUI journeys
- **AI Screen Generation** - Generate UI screens from natural language using AWS Bedrock
- **Supabase Authentication** - Secure email/password authentication with session persistence

## Tech Stack

- **Frontend**: React 19, Vite, React Router 7, TypeScript
- **Backend**: Express.js, Node.js
- **Authentication**: Supabase
- **Voice AI**: Azure OpenAI Realtime API (WebRTC)
- **AI Generation**: AWS Bedrock (Claude)
- **Design System**: Pelago (ES Rebond Grotesque, Suisse Neue fonts)

## Project Structure

```
sduit/
├── apps/
│   ├── web/              # React/Vite frontend (port 5173)
│   │   ├── src/
│   │   │   ├── components/   # Reusable components
│   │   │   ├── contexts/     # React contexts (Auth, Voice Agent)
│   │   │   ├── hooks/        # Custom hooks
│   │   │   ├── pages/        # Page components
│   │   │   └── styles/       # Global styles & design system
│   │   └── public/
│   └── api/              # Express.js backend (port 3001)
│       └── src/
├── packages/
│   └── shared/           # Shared utilities
├── assets/
│   ├── animations/       # Lottie JSON animations
│   ├── fonts/            # Pelago design system fonts
│   └── prompts/          # Voice agent prompt templates
└── scripts/              # Utility scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Supabase project
- Azure OpenAI resource with Realtime API enabled
- AWS account with Bedrock access (for AI generation)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd sduit

# Install dependencies
npm install
```

### Environment Setup

Create environment files:

**apps/web/.env**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**apps/api/.env**
```env
# Azure OpenAI (for Voice Agent)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name

# AWS Bedrock (for AI Screen Generation)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

### Development

```bash
# Start both web and API servers
npm run dev:all

# Start web only (port 5173)
npm run dev

# Start API only (port 3001)
npm run dev:api
```

### Build

```bash
npm run build
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Voice Agent | Run real-time voice sessions |
| `/builder` | Journey Builder | Create and edit SDUI journeys |
| `/settings` | Settings | App preferences |
| `/login` | Login | Authentication |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET/POST | `/api/session` | Create Azure OpenAI session |
| POST | `/generate-screens` | AI screen generation |

## Commit Convention

This project uses JIRA ticket-based commits:

```
[POLICE-XXX] type: description
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## License

Proprietary - Pelago
