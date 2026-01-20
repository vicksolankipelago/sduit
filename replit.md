# SDUI Journey Builder

A Server-Driven UI Journey Builder for designing and testing voice agent experiences with real-time AI capabilities.

## Overview

This is a React/Vite frontend with an Express.js API backend. The application allows users to create and test voice agent journeys with SDUI screens.

## Project Structure

- `apps/web/` - React 19 frontend with Vite (port 5000)
- `server/` - Express.js backend API (port 3001)
- `shared/` - Shared database schema (Drizzle ORM)
- `packages/shared/` - Shared utilities
- `assets/` - Fonts, animations, and prompt templates

## Running the App

The workflow "SDUI Journey Builder" runs both frontend and API concurrently using `npm run dev`.

- Frontend: http://localhost:5000
- API: http://localhost:3001 (proxied through Vite at /api/*)

## Authentication

The application uses Replit Auth for authentication:
- Login: Redirects to `/api/login` which initiates OAuth flow with Replit
- Logout: Redirects to `/api/logout` to clear session
- User info: Available at `/api/auth/user`

## Database

Uses PostgreSQL with Drizzle ORM. Schema defined in `shared/schema.ts`:
- `users` - User profiles from Replit Auth
- `sessions` - Express session storage
- `journeys` - User-created voice agent journeys
- `voice_sessions` - Saved voice session transcripts

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Deployment name for realtime API
- `AWS_BEARER_TOKEN_BEDROCK` - AWS Bedrock token for AI generation
- `AWS_REGION` - AWS region (default: us-east-1)
- `REPLIT_DOMAINS` - Auto-configured by Replit for auth

## Tech Stack

- Frontend: React 19, Vite, React Router 7, TypeScript
- Backend: Express.js, Node.js
- Authentication: Replit Auth (OpenID Connect)
- Database: PostgreSQL with Drizzle ORM
- Voice AI: Azure OpenAI Realtime API (WebRTC)
- AI Generation: AWS Bedrock (Claude)

## API Routes

### Authentication
- `GET /api/auth/user` - Get current authenticated user
- `GET /api/login` - Initiate Replit OAuth login
- `GET /api/logout` - Logout and clear session
- `GET /api/callback` - OAuth callback handler

### Journeys
- `GET /api/journeys` - List user's journeys
- `GET /api/journeys/:id` - Get journey by ID
- `POST /api/journeys` - Create new journey
- `PUT /api/journeys/:id` - Update journey
- `DELETE /api/journeys/:id` - Delete journey
- `POST /api/journeys/:id/duplicate` - Duplicate journey

### Voice Sessions
- `GET /api/voice-sessions` - List user's voice sessions
- `GET /api/voice-sessions/:id` - Get session by ID
- `POST /api/voice-sessions` - Save voice session
- `DELETE /api/voice-sessions/:id` - Delete session

## Recent Changes

- 2026-01-20: Refactored authentication from Supabase to Replit Auth
- 2026-01-20: Migrated database storage to PostgreSQL with Drizzle ORM
- 2026-01-20: Configured Vite proxy to route /api/* to Express API server
