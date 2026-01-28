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
*   **Publishing System:** Features a distinct development and production environment separation, with an explicit publishing workflow that stores ready journeys in Object Storage for production deployment.
*   **Voice Interaction & Recording:** Manages real-time voice sessions, including recording audio chunks, saving full session transcripts, and providing playback functionality with audio-synced text highlighting.
*   **Feedback System:** Allows users to submit ratings and comments linked to voice sessions, providing valuable insights into journey performance.
*   **Preview Access System:** Administrators can generate temporary, revocable credentials for preview users, facilitating testing and research studies without full registration. Bulk creation and CSV export of credentials are supported.
*   **System Tooling:** Integrates a core `end_call` tool for AI agents to gracefully conclude conversations.
*   **UI/UX:** The frontend is built with React 19 and Vite, focusing on an intuitive flow builder experience. Navigation is role-specific, and all emojis have been replaced with professional SVG icons. Agent editor functionality is directly embedded within the journey page for streamlined workflow.

## External Dependencies

*   **Database:** PostgreSQL (with Drizzle ORM)
*   **Frontend Framework:** React 19, Vite
*   **Backend Framework:** Express.js, Node.js
*   **Authentication:** Passport.js (passport-local)
*   **Voice AI:** Azure OpenAI Realtime API (WebRTC)
*   **AI Generation:** AWS Bedrock (Claude)
*   **Object Storage:** Used for storing published flows and audio recordings.
*   **Prolific:** Integration for tracking research study participants via URL parameters (`PROLIFIC_PID`, `STUDY_ID`, `SESSION_ID`).