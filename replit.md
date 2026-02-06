# Flow Builder

A Flow Builder for designing and testing voice agent experiences with real-time AI capabilities.

## Overview

This project provides a comprehensive platform for designing, testing, and deploying interactive voice agent experiences. It enables users to create conversational flows, integrate SDUI (Speech Dialogue User Interface) screens, and simulate real-time voice interactions. The system supports both voice-enabled and non-voice (button-based) journeys, catering to diverse interactive application needs, from complex voice assistants to interactive quizzes. The platform aims to streamline the development of dynamic and engaging user experiences through intuitive flow building and robust testing capabilities, including features for research studies and preview access management.

## User Preferences

I prefer clear, concise summaries of features and architecture. When making changes, prioritize modularity and maintainability. For new features, please outline the proposed API changes and user interface implications before implementation. I appreciate detailed explanations of complex technical decisions.

## System Architecture

The application is built as a monorepo with a React 19 frontend (Vite) and an Express.js API backend. It utilizes PostgreSQL with Drizzle ORM for data persistence across various entities such as users, sessions, journeys, and voice interactions.

**Key Architectural Decisions:**

*   **Monorepo Structure:** Organizes frontend (`apps/web/`), backend (`server/`), and shared code (`shared/`, `packages/shared/`) for co-development and code sharing.
*   **SDUI Integration:** Designed to incorporate Speech Dialogue User Interface screens within conversational flows, allowing for rich interactive experiences.
*   **Authentication & Authorization:** Implements email/password authentication via Passport.js with secure session management, password hashing, and role-based access control (Admin/Test roles). A "Terms & Conditions" acceptance mechanism is also integrated.
*   **Journey Management:** Supports creation, editing, deletion, duplication, and versioning of voice agent journeys. Journeys can be configured as `voiceEnabled` or non-voice.
*   **Publishing System:** Features a distinct development and production environment separation, with an explicit publishing workflow that stores ready journeys in Object Storage for production deployment. Production editing uses `loadJourneyForRuntime` to ensure editors load from Object Storage (source of truth), not stale database/localStorage data. **Production flows may not exist in the dev database** — this is expected and fully supported. All CRUD operations in production go directly to Object Storage, bypassing the database entirely.
*   **Auto-Save:** Agent editor features debounced auto-save (1.5s delay) for quick iteration. In production, saves go directly to Object Storage only (no DB write), so prompt changes are immediately available to new voice sessions. Save failures throw and are surfaced to the user as "Save failed" in the editor UI.
*   **Voice Interaction & Recording:** Manages real-time voice sessions, including recording audio chunks, saving full session transcripts, and providing playback functionality with audio-synced text highlighting.
*   **Feedback Survey System:** Full-screen multi-step survey after voice sessions collecting:
    - Overall experience rating (1-5 stars)
    - Conversation naturalness rating (1-5)
    - Information helpfulness rating (1-5)
    - App download intent (yes/maybe/no)
    - Open-ended feedback (liked most, improvements, comments)
    - Prolific completion code support for research participants
*   **Preview Access System:** Administrators can generate temporary, revocable credentials for preview users, facilitating testing and research studies without full registration. Preview credentials are now flow-specific (tied to individual journeys via `journeyId`), accessible through the flow settings when a journey is configured as an external study. Supports bulk creation and CSV export of credentials.
*   **System Tooling:** Integrates a core `end_call` tool for AI agents to gracefully conclude conversations.
*   **Flow Composition System:** Enables linking multiple journeys together where data flows between them. Key components:
    - `flowContext`: Persistent key-value store in AgentUIContext that survives journey transitions
    - `start_journey` tool: Allows a button/CTA to trigger loading and starting a different journey, automatically passing collected data
    - `{{key}}` prompt interpolation: Prompts can reference values from flowContext (e.g., `{{feelings_alcohol}}`, `{{goal_alcohol}}`), which are replaced at runtime
    - **Quiz Option ID Transformation**: Quiz answers are stored as option IDs (e.g., `drink_less`, `physical_health`) and automatically transformed to readable labels via `QUIZ_OPTION_LABELS` mapping before being passed to prompts and ElevenLabs dynamic variables
    - Supports both flat keys and nested dotted paths for flexible data referencing
*   **Image Carousel Element:** A new screen builder element (`imageCarousel`) that displays images in a continuously animated horizontal scroll. Configurable properties include scroll speed (px/s), card height, gap between cards, and pause-on-hover behavior. Images are defined as an array of `{ imageUrl, title, subtitle? }` objects. Uses CSS keyframe animation with duplicated content for seamless infinite looping.
*   **UI/UX:** The frontend is built with React 19 and Vite, focusing on an intuitive flow builder experience. Navigation is role-specific, and all emojis have been replaced with professional SVG icons. Agent editor functionality is directly embedded within the journey page for streamlined workflow.

## External Dependencies

*   **Database:** PostgreSQL (with Drizzle ORM)
*   **Frontend Framework:** React 19, Vite
*   **Backend Framework:** Express.js, Node.js
*   **Authentication:** Passport.js (passport-local)
*   **Voice AI:** Azure OpenAI Realtime API (WebRTC), ElevenLabs Conversational AI (alternative TTS provider)
    - **ElevenLabs Override Rules:** Only `prompt` (string) and `voiceId` are supported as SDK overrides. Tools must be configured in the ElevenLabs dashboard, NOT via SDK overrides. The `overrides.agent.prompt` object only accepts `prompt` and `llm` fields — adding unsupported fields (like `tools`) causes silent rejection of the entire override. Client tool handlers are passed separately via `clientTools` at hook initialization.
*   **AI Generation:** AWS Bedrock (Claude)
*   **Object Storage:** Used for storing published flows and audio recordings.
*   **Prolific:** Integration for tracking research study participants via URL parameters (`PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`).