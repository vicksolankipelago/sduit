# SDUI Journey Builder

A Server-Driven UI Journey Builder for designing and testing voice agent experiences with real-time AI capabilities.

## Overview

This is a React/Vite frontend with an Express.js API backend. The application allows users to create and test voice agent journeys with SDUI screens.

## Project Structure

- `apps/web/` - React 19 frontend with Vite (port 5000)
- `apps/api/` - Express.js backend API (port 3001)
- `packages/shared/` - Shared utilities
- `assets/` - Fonts, animations, and prompt templates

## Running the App

The workflow "SDUI Journey Builder" runs both frontend and API concurrently using `npm run dev`.

- Frontend: http://localhost:5000
- API: http://localhost:3001

## Environment Variables

### Frontend (apps/web/.env)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### Backend (apps/api/.env)
- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY` - Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Deployment name for realtime API
- `AWS_BEARER_TOKEN_BEDROCK` - AWS Bedrock token for AI generation
- `AWS_REGION` - AWS region (default: us-east-1)

## Tech Stack

- Frontend: React 19, Vite, React Router 7, TypeScript
- Backend: Express.js, Node.js
- Authentication: Supabase
- Voice AI: Azure OpenAI Realtime API (WebRTC)
- AI Generation: AWS Bedrock (Claude)

## Recent Changes

- 2026-01-20: Configured for Replit environment (port 5000, allowed hosts)
