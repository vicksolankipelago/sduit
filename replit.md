# Flow Builder

A Flow Builder for designing and testing voice agent experiences with real-time AI capabilities.

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

The application uses email/password authentication with Passport.js:
- Register: POST to `/api/register` with email, password, firstName (optional), lastName (optional)
- Login: POST to `/api/login` with email and password
- Logout: POST to `/api/logout` to clear session
- User info: GET `/api/auth/user`

Security features:
- Password hashing with scrypt and per-user random salt
- Session regeneration on login/register to prevent session fixation
- Session destruction and cookie clearing on logout

## User Roles

The application supports two user roles:

### Admin
- Can create, edit, delete, and duplicate journeys
- Can access Journey Builder and Screens pages
- Can view all feedback from all users
- Default role for new users

### Test
- Can start journeys and test voice interactions
- Can submit feedback after completing sessions
- Cannot create/edit/delete journeys
- Only sees Journeys and Transcripts navigation items

## Database

Uses PostgreSQL with Drizzle ORM. Schema defined in `shared/schema.ts`:
- `users` - User profiles with email, hashed password, and role (admin/test)
- `sessions` - Express session storage
- `journeys` - User-created voice agent journeys
- `voice_sessions` - Saved voice session transcripts
- `feedback` - User feedback linked to voice sessions (rating + comments)

## Environment Variables

### Backend
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `SESSION_SECRET` - Secret for session encryption
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Deployment name for realtime API
- `AWS_BEARER_TOKEN_BEDROCK` - AWS Bedrock token for AI generation
- `AWS_REGION` - AWS region (default: us-east-1)

## Tech Stack

- Frontend: React 19, Vite, React Router 7, TypeScript
- Backend: Express.js, Node.js
- Authentication: Email/password with Passport.js (passport-local)
- Database: PostgreSQL with Drizzle ORM
- Voice AI: Azure OpenAI Realtime API (WebRTC)
- AI Generation: AWS Bedrock (Claude)

## API Routes

### Authentication
- `GET /api/auth/user` - Get current authenticated user
- `POST /api/register` - Register new user with email/password
- `POST /api/login` - Login with email/password
- `POST /api/logout` - Logout and clear session

### Journeys
- `GET /api/journeys` - List user's journeys
- `GET /api/journeys/:id` - Get journey by ID
- `POST /api/journeys` - Create new journey
- `PUT /api/journeys/:id` - Update journey
- `DELETE /api/journeys/:id` - Delete journey
- `POST /api/journeys/:id/duplicate` - Duplicate journey
- `GET /api/journeys/export/all` - Export all journeys as JSON (admin only)
- `POST /api/journeys/import` - Import journeys from JSON (admin only)

### Voice Sessions
- `GET /api/voice-sessions` - List user's voice sessions
- `GET /api/voice-sessions/:id` - Get session by ID
- `POST /api/voice-sessions` - Save voice session
- `DELETE /api/voice-sessions/:id` - Delete session

### Feedback
- `GET /api/feedback` - List feedback (admins see all, test users see their own)
- `GET /api/feedback/:id` - Get feedback by ID with transcript
- `POST /api/feedback` - Submit feedback (rating 1-5, optional comment)

## Recent Changes

- 2026-01-21: Screen cards on Screens page are now clickable to open the Screen Builder directly
- 2026-01-21: Removed template section and preview button from AgentNodeEditor - Edit now navigates to Screen Builder
- 2026-01-21: Screens page now shows all screens including those embedded in flows/journeys, with journey source info displayed
- 2026-01-21: Added screen editing functionality to AgentNodeEditor - users can now add, edit, preview, and delete screens directly from the agent editor
- 2026-01-21: Fixed transcript duplication bug where first text chunk was added twice
- 2026-01-20: Added role-based access control (admin/test roles)
- 2026-01-20: Added feedback system with ratings and comments linked to voice sessions
- 2026-01-20: Updated navigation to show role-specific menu items
- 2026-01-20: Migrated authentication from Replit Auth to email/password with Passport.js
- 2026-01-20: Added secure session management with session regeneration and destruction
- 2026-01-20: Migrated database storage to PostgreSQL with Drizzle ORM
- 2026-01-20: Configured Vite proxy to route /api/* to Express API server
