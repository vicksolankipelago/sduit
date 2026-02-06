# AI Flow Editing Integration Plan (Preview + Rollback First)

## Objective

Add an in-product AI assistant that can:

- Generate complete SDUI flow structures.
- Update existing flows from natural-language feedback.
- Keep prompts and screens synchronized.
- Require preview before apply.
- Allow fast rollback.

## Recommended Architecture

### 1) Proposal API (No-Write)

Add a draft proposal endpoint:

- `POST /api/journeys/:id/ai/proposals`

Input:

- Target scope (`journey`, `agentId`, optional `screenId` list)
- User request text
- Optional feedback on prior proposal

Output:

- `proposalId`
- `summary`
- `updatedJourneyDraft`
- `changedPaths`
- `validation` (errors/warnings)

Rule:

- Never write journey data here.

### 2) Validation Gate

Run structural checks before proposal is shown as “ready”:

- Journey/agent/link integrity
- Screen/event validity
- `screenPrompts` ↔ `screens` key alignment
- Event IDs referenced in prompt text
- Navigation target sanity

Reject apply when validation has errors.

### 3) Diff + Preview UI

In `JourneyBuilder`:

- Add “AI Edit Flow” action.
- Show proposal summary and structured diff:
  - Prompt changes (system, agent, screenPrompts)
  - Screen add/remove/update
  - Event add/remove/update
- Render changed screens in existing `ScreenPreview`.
- Expose “Try again with feedback” without losing current draft.

### 4) Apply API (Write)

Add apply endpoint:

- `POST /api/journeys/:id/ai/proposals/:proposalId/apply`

Behavior:

- Persist proposal as journey update.
- Save `changeNotes` with `AI:` prefix and short summary.
- Return saved journey + new version metadata.

### 5) Retry API

Add retry endpoint:

- `POST /api/journeys/:id/ai/proposals/:proposalId/retry`

Behavior:

- Accept user feedback.
- Generate a new proposal from previous draft + feedback.
- Keep old proposal for audit and comparison.

### 6) Rollback UX

Reuse existing version APIs immediately after apply:

- Add “Undo Last AI Apply” button:
  - Resolve previous version
  - Call restore endpoint

Keep full version history accessible via existing Version History modal.

## Data Contracts

## AI Proposal Shape

```json
{
  "proposalId": "uuid",
  "summary": "Add onboarding intro + tighten motivational prompts",
  "changedPaths": [
    "systemPrompt",
    "agents[0].prompt",
    "agents[0].screens[2]",
    "agents[0].screenPrompts['screen_xyz']"
  ],
  "validation": {
    "errors": [],
    "warnings": []
  },
  "updatedJourneyDraft": {}
}
```

## Apply Audit Fields

- `changeNotes`: `AI: <short summary>`
- `changeSource`: `ai-assistant` (if you add metadata support)
- `proposalId`

## Incremental Delivery

1. Proposal + validation API (read-only draft generation).
2. JourneyBuilder preview pane + diff view.
3. Apply endpoint + versioned save notes.
4. Retry endpoint + feedback loop.
5. Undo shortcut + telemetry.

## Why This Is Safest For sduit

- Uses existing typed model and version history.
- Avoids silent writes from model output.
- Forces human review before persist.
- Keeps rollback one action away.
- Scales from screen-generation-only to full-flow editing without replacing current architecture.
