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

### Terms & Conditions
- Members must accept terms before using the application
- Terms modal appears after registration/login for members who haven't accepted
- Covers consent for voice recording, data processing, and AI model training
- Accept terms: POST to `/api/auth/accept-terms` (updates user's termsAcceptedAt timestamp)
- Admins are not required to accept terms

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
- `journey_versions` - Version history for journeys (automatically created on every save)
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
- `GET /api/journeys/:id/versions` - List version history for a journey
- `GET /api/journeys/:id/versions/:versionId` - Get specific version details
- `GET /api/journeys/:id/export` - Export journey config with transcripts (for external review)
- `POST /api/journeys/:id/import` - Import journey config to update flow (admin only)
- `POST /api/journeys/:id/versions/:versionId/restore` - Restore to a previous version (admin only)
- `POST /api/journeys/:id/publish` - Publish journey to production (stores in Object Storage)
- `POST /api/journeys/:id/unpublish` - Unpublish journey from production
- `GET /api/journeys/environment` - Get current environment (development/production)
- `GET /api/journeys/production/list` - List published flows (public endpoint)
- `GET /api/journeys/production/:journeyId` - Get published flow (public endpoint)

### Voice Sessions
- `GET /api/voice-sessions` - List user's voice sessions
- `GET /api/voice-sessions/:id` - Get session by ID
- `POST /api/voice-sessions` - Save voice session
- `DELETE /api/voice-sessions/:id` - Delete session

### Feedback
- `GET /api/feedback` - List feedback (admins see all, test users see their own)
- `GET /api/feedback/:id` - Get feedback by ID with transcript
- `POST /api/feedback` - Submit feedback (rating 1-5, optional comment)

### Recordings
- `POST /api/recording/start` - Start a new recording session
- `POST /api/recording/chunk` - Upload an audio chunk
- `POST /api/recording/end` - End a recording session
- `GET /api/recordings` - List all recordings
- `GET /api/recordings/:sessionId` - Get recording session details
- `GET /api/recordings/:sessionId/audio` - Stream full audio for playback
- `GET /api/recordings/:sessionId/chunks/:chunkIndex` - Download a specific chunk
- `DELETE /api/recordings/:sessionId` - Delete a recording session

## System Tool Calls

The following system tools are automatically available to all agents in all flows:

- `end_call(reason?: string)` - Ends the current realtime session and closes the flow. The AI agent can call this tool when the conversation should end. The system will wait for any remaining audio to complete before disconnecting and showing the feedback modal.

## Publishing System (Dev/Prod Separation)

The application supports separate development and production environments with an explicit publishing workflow:

### How It Works
1. **Development**: Users create and iterate on journeys in the development database
2. **Publishing**: When a journey is ready, users click "Publish" to copy it to Object Storage (shared between dev/prod)
3. **Production**: The production runtime automatically loads published flows from Object Storage instead of the development database

### Architecture
- Development database: PostgreSQL (Replit's development database)
- Production database: PostgreSQL (Replit's production database) 
- Shared storage: Object Storage for published flows (JSON files)
- Environment detection: Uses NODE_ENV on server, URL-based fallback on client

### Key Files
- `server/services/publishedFlowStorage.ts` - Object Storage service for published flows
- `apps/web/src/services/journeyStorage.ts` - Client-side environment detection and flow loading
- `shared/models/journeys.ts` - Database schema with publish status fields

### Environment Detection
The client detects environment using:
1. API call to `/api/journeys/environment` (uses server's NODE_ENV)
2. URL-based fallback: `.replit.dev` domains are development, all others default to production

## Recent Changes

- 2026-01-27: Added terms & conditions modal - members must accept terms covering voice recording consent and AI model training before using the app
- 2026-01-27: Added audio-synced transcript scrolling - messages now display audio timestamps, auto-scroll during playback, and highlight the currently playing message. Click any message to jump to that point in the recording.
- 2026-01-23: Added dev/prod publishing system - users can now publish flows to production using Object Storage
- 2026-01-23: Fixed audio recording and playback - recordings now properly save to Object Storage and play back in transcript view with correct duration display
- 2026-01-23: Added audio playback in transcript detail view - users can now listen to session recordings with play/pause and seek controls
- 2026-01-23: Enhanced end_call system tool to properly wait for audio completion before disconnecting
- 2026-01-22: Integrated agent editor directly into journey page - replaced drag-and-drop canvas with dropdown selector and embedded Configuration/Tools/Screens tabs
- 2026-01-22: All transcripts are now visible to all admin users (shared like journeys)
- 2026-01-21: Added version history for prompts - users can view and restore previous versions of journeys via the History button
- 2026-01-21: Replaced all emojis with professional SVG icons across the UI
- 2026-01-21: Simplified System Prompt Editor by removing Variables, Preview, and Reset to Default buttons
- 2026-01-21: Added end_call tool - AI agent can now call end_call() to end the conversation and show the feedback modal
- 2026-01-21: Journeys are now shared across all users - all admins can see and edit all journeys
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
