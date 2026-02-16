---
name: sduit-sdui-flow-assistant
description: Build, revise, and validate SDUI journey flows in sduit, including `Journey`/`Agent` config, SDUI screens, screen events, `screenPrompts`, and prompt-to-screen alignment. Use when asked to generate new SDUI flows, update existing flows from feedback, review SDUI config quality, add AI-powered flow editing in the app, or implement safe preview and rollback for flow changes.
---

# SDUI Flow Assistant

Use this skill to make complete, safe SDUI flow updates in the `sduit` codebase.

## Load Context

Read these files first:

- `apps/web/src/types/journey.ts`
- `apps/web/src/lib/voiceAgent/elementRegistry.ts`
- `apps/web/src/lib/voiceAgent/screenTemplates.ts`
- `apps/web/src/services/screenImport.ts`
- `apps/web/src/services/screenExport.ts`
- `apps/web/src/lib/voiceAgent/journeyRuntime.ts`
- `server/routes/mobile.ts`
- `server/utils/moduleNormalize.ts`
- `apps/web/src/components/voiceAgent/JourneyBuilder.tsx`
- `apps/web/src/components/voiceAgent/PromptEditor.tsx`
- `server/routes/journeys.ts`
- `server/storage.ts`

For iOS compatibility rules and the complete SDUI data contract, load:

- `SDUI_PROTOCOL.md` **(REQUIRED — defines the iOS data contract)**

For architecture details and rollout strategy, load:

- `references/sduit-flow-architecture.md`
- `references/ai-editing-integration.md`

## Workflow

1. Clarify the requested flow outcome.
2. Identify scope: `systemPrompt`, agent `prompt`, `screenPrompts`, screen structure, and event wiring.
3. Preserve IDs when editing existing flows unless the user requests a new object.
4. Update prompts and screens together so behavior and UI stay synchronized.
5. Validate before apply:
   - `node skills/sduit-sdui-flow-assistant/scripts/validate_flow_bundle.mjs <path/to/journey.json>`
6. Create a rollback point before destructive edits:
   - `node skills/sduit-sdui-flow-assistant/scripts/flow_snapshot.mjs snapshot <path/to/journey.json> [label]`
7. Apply changes only after preview/review; if regression appears, restore:
   - `node skills/sduit-sdui-flow-assistant/scripts/flow_snapshot.mjs restore <path/to/journey.json> <snapshot-path>`
8. If a prompt or prompt-screen regression is fixed, append a memory entry to:
   - `skills/sduit-sdui-flow-assistant/PROMPT_ISSUES.md`

## Prompt Regression Memory (Required)

Use this section whenever debugging real runs/transcripts.

### When to update memory

Update `PROMPT_ISSUES.md` when ALL are true:

1. A real transcript/log shows a prompt-flow failure (wrong-screen event, stale event reuse, premature/late navigation, screen mismatch, etc.).
2. A fix is made in prompt text, screen prompts, or runtime guardrails.
3. The fix changes expected agent behavior.

### Entry template

Add one concise entry per issue:

- Date
- Symptom (what happened in transcript)
- Root cause (prompt ambiguity / screen mismatch / stale event / timing)
- Fix applied (exact files + key rule text)
- Verification evidence (what log pattern should disappear, what should appear instead)

Keep entries short and practical. Prefer patterns and rules over one-off anecdotes.

## Guardrails

- **Follow `SDUI_PROTOCOL.md`** — it defines the complete iOS data contract.
- Element data goes under `"state"` (not `"data"`). Every `state` must include `"id"`.
- State references MUST use braces: `"{$moduleData.key}"`.
- Event `conditions` must always be present (use `[]` for no conditions).
- Arrays in module state must be native arrays, never comma-joined strings.
- Only use element types listed in `SDUI_PROTOCOL.md`. Made-up types crash iOS.
- Keep `screenPrompts` keys aligned with `agent.screens[].id`.
- Use `navigate_to` for screen-to-screen navigation in prompts.
- Reserve `trigger_event` for element interactions (for example selection, permissions, completion) and keep those event IDs aligned with real events defined on screens/elements.
- Keep navigation actions pointing to valid targets (`next-screen`, `prev-screen`, or real screen IDs/URLs).
- Keep `startingAgentId` valid and handoff targets resolvable.
- Use `apps/web/src/lib/voiceAgent/screenUtils.ts` behavior as the source of truth for placeholder deeplinks.
- Prefer additive, reversible edits over destructive rewrites.

## Implementation Guidance For In-Product AI Editing

When asked to add AI editing in the app, follow this baseline:

1. Generate proposal first (no immediate save).
2. Show structured preview (prompt diff + screen diff + rendered screen preview).
3. Run validation gate before apply.
4. Save with explicit `changeNotes`.
5. Offer one-click rollback via existing journey version endpoints.

Use `references/ai-editing-integration.md` for the concrete phased design.

## Additional Resources

- Prompt regression history and reusable fixes: `PROMPT_ISSUES.md`
