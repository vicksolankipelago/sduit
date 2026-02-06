# SDUI Flow Architecture (sduit)

## Core Data Model

- Canonical types: `apps/web/src/types/journey.ts`
- Top hierarchy:
  - `Journey`
  - `agents[]`
  - `Agent.screens[]`
  - `Screen.sections[]`
  - `Section.elements[]`
  - `events` on screens/elements
- Prompt hierarchy:
  - `Journey.systemPrompt` (global)
  - `Agent.prompt` (agent-level)
  - `Agent.screenPrompts[screenId]` (screen-level)

## Prompt + Runtime Composition

- Runtime combiner: `apps/web/src/lib/voiceAgent/journeyRuntime.ts`
- Agent instructions are composed from:
  - `systemPrompt`
  - `agent.prompt`
  - `screenPrompts` rendered as `## SCREEN: <id>` blocks
- `trigger_event` is a required runtime/system tool in screen-driven flows.

## SDUI Screen Authoring + Defaults

- Element defaults and metadata: `apps/web/src/lib/voiceAgent/elementRegistry.ts`
- Screen templates: `apps/web/src/lib/voiceAgent/screenTemplates.ts`
- Builder/editor surface: `apps/web/src/components/voiceAgent/JourneyBuilder.tsx`
- Screen prompt editor: `apps/web/src/components/voiceAgent/PromptEditor.tsx`

## Import/Export Contracts

- Import module + prompt parsing: `apps/web/src/services/screenImport.ts`
- Export iOS-normalized module + prompt text: `apps/web/src/services/screenExport.ts`
- Prompt parsing contract:
  - Screen prompt sections use `## SCREEN: <screen_id>`

## iOS/Mobile Contract

- Module normalization: `server/utils/moduleNormalize.ts`
- Mobile endpoints: `server/routes/mobile.ts`
- Key response shape:
  - `module: { id, state, conditions, screens }`
  - `screenPrompts: { [screenId]: string }`

## Safety + Rollback Baseline

- Version creation on each journey update: `server/storage.ts`
- Version API:
  - List: `GET /api/journeys/:id/versions`
  - Read: `GET /api/journeys/:id/versions/:versionId`
  - Restore: `POST /api/journeys/:id/versions/:versionId/restore`
- Route implementation: `server/routes/journeys.ts`

## Existing AI Entry Point

- Frontend AI screen suggestion service: `apps/web/src/services/aiScreenGenerator.ts`
- Backend generation endpoint: `POST /generate-screens` in `server/index.ts`
- Current behavior:
  - Suggests screens from prompts
  - Does not yet provide full-journey edit proposals with explicit apply/rollback

## Invariants To Preserve

- `startingAgentId` references an existing agent.
- Every handoff target exists.
- `screenPrompts` keys map only to existing screens.
- Event IDs used in prompts are present in screen/element events.
- Navigation deeplinks resolve to valid targets (`next-screen`, `prev-screen`, real IDs, or valid URLs).
