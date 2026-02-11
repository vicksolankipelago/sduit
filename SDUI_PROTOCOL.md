# SDUI Protocol Specification

> **This document is the single source of truth for the Server-Driven UI (SDUI) data contract
> between the sduit flow builder and the iOS mobile app.**
>
> Any LLM, code generator, or human editing journey JSON, prompts, or tool definitions
> **MUST** follow these rules exactly. Breaking these conventions will cause iOS parsing
> failures, silent data loss, or blank screens.
>
> Mobile API response stability is documented in `server/MOBILE_RENDER_CONTRACT.md`.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [JSON Hierarchy](#2-json-hierarchy)
3. [State Architecture](#3-state-architecture)
4. [Variable References & Interpolation](#4-variable-references--interpolation)
5. [Conditions (JSON Logic)](#5-conditions-json-logic)
6. [Element Conditions (Conditional Rendering)](#6-element-conditions-conditional-rendering)
7. [Events & Actions](#7-events--actions)
8. [System Tools](#8-system-tools)
9. [Element Types & Data Contracts](#9-element-types--data-contracts)
10. [Prompt–Screen Alignment](#10-promptscreen-alignment)
11. [Recipes: Common Patterns](#11-recipes-common-patterns)
12. [Common Mistakes & Guardrails](#12-common-mistakes--guardrails)

---

## 1. Core Concepts

| Term | Definition |
|------|-----------|
| **Journey** | A complete SDUI flow — contains agents, screens, prompts, and tools. |
| **Module** | The iOS-side container for a journey. Has its own persistent state. |
| **Screen** | A single UI page with sections of elements. |
| **Section** | A layout container within a screen (`fixed-top`, `body`, `fixed-bottom`). |
| **Element** | A UI component (text, button, checklist, etc.) within a section. |
| **Event** | A named trigger attached to a screen or element (e.g. `onSelected`, `custom`). |
| **Action** | What happens when an event fires (navigate, update state, call tool, etc.). |
| **Condition** | A JSON Logic rule that gates whether an element renders or an action executes. |
| **Tool** | A function the voice agent can call (e.g. `trigger_event`, `set_goals`). |

---

## 2. JSON Hierarchy

```
Journey
├── agents[]
│   ├── prompt (agent-level instructions)
│   ├── tools[] (agent-specific tools)
│   ├── screens[]
│   │   ├── id: string                    ← MUST be unique within journey
│   │   ├── title: string | null
│   │   ├── hidesBackButton?: boolean
│   │   ├── state?: { key: value }        ← initial screen state
│   │   ├── events?: ScreenEvent[]        ← screen-level events
│   │   └── sections[]
│   │       ├── id: string
│   │       ├── position: "fixed-top" | "body" | "fixed-bottom"
│   │       ├── layout?: "stack" | "grid"
│   │       └── elements[]
│   │           ├── type: ElementType     ← MUST be a supported type
│   │           ├── state: { ... }        ← element data (NOT "data")
│   │           ├── style?: { ... }
│   │           ├── events?: ScreenEvent[]
│   │           └── conditions?: EventConditions[]
│   └── screenPrompts: { [screenId]: string }
└── systemPrompt (global prompt)
```

### Critical Rules

- Element data is stored under the `"state"` key, **NOT** `"data"`. iOS decodes from `state`.
- Every `state` object MUST contain an `"id"` field (string).
- Screen IDs must be unique. Element IDs should be unique within a screen.
- Section `position` defaults to `"body"` if omitted.

---

## 3. State Architecture

There are exactly **two state scopes**. This mirrors iOS `EventStateManager`.

### Screen State (`$state` / `$screenData`)

- **Scope**: Per-screen. Resets when navigating to a new screen.
- **Use for**: Transient UI values — selected option, form input, toggle state.
- **Write**: Via `stateUpdate` action with `scope: "screen"` (default).
- **Read**: `{$state.key}` or `{$screenData.key}` in interpolation.

### Module State (`$moduleData`)

- **Scope**: Per-module (journey). Persists across all screens for the entire session.
- **Use for**: Captured user data — goals, name, reminder time, quiz answers.
- **Write**: Via `stateUpdate` action with `scope: "module"`, or system tools.
- **Read**: `{$moduleData.key}` in interpolation and element data bindings.

### Writing to State

```json
{
  "type": "stateUpdate",
  "scope": "module",
  "updates": {
    "reminderTime": "9:00 AM"
  }
}
```

If `scope` is omitted, it defaults to `"screen"`.

---

## 4. Variable References & Interpolation

### Format: Always Use Braces

Variable references **MUST** use the braced format:

```
{$moduleData.keyName}    ← module state
{$state.keyName}         ← screen state
{$screenData.keyName}    ← screen state (alias)
{$screenState.keyName}   ← screen state (alias, web only)
```

**iOS expects braces.** The `resolveVariable` method strips braces first, then checks the
`$moduleData.` or `$state.` prefix. References without braces are treated as literal strings.

### Where References Are Resolved

| Context | Resolution |
|---------|-----------|
| Element `state` values | String interpolation → returns string. For pure references (entire value is one `{$moduleData.key}`) → returns native type (array, object). |
| Condition `state` values | Resolved to native type for JSON Logic evaluation. |
| Event action `updates` | Resolved before writing to state. |
| Navigation `deeplink` | String interpolation (e.g. `screen/{$state.nextId}`). |
| Prompt `{{variable}}` | Resolved from module state at runtime. |

### Native Type Resolution (ResolvableValue)

When an element's `state` property is a **pure reference** (the entire string is one
braced variable, e.g. `"{$moduleData.goalTitles}"`), the resolved value is returned
as its **native type** — array, object, number, etc. This is critical for elements
like `checklistCard` whose `itemTitles` expects `string[]`, not a stringified array.

```json
{
  "type": "checklistCard",
  "state": {
    "id": "goals_checklist",
    "title": "Your goals",
    "itemTitles": "{$moduleData.goalTitles}"
  }
}
```

If `moduleState.goalTitles` is `["Drink less", "Sleep better"]`, then `itemTitles`
resolves to the array `["Drink less", "Sleep better"]` — not the string
`"Drink less,Sleep better"`.

---

## 5. Conditions (JSON Logic)

Conditions use the [JSON Logic](https://jsonlogic.com/) format and appear in three places:

1. **Element conditions** — control whether an element is rendered
2. **Event conditions** — control whether an event fires
3. **Action conditions** — control whether a specific action within an event executes

### Condition Structure

```json
{
  "conditions": [
    {
      "rules": { "<json-logic-operator>": [ ... ] },
      "state": {
        "<localVarName>": "{$moduleData.someKey}"
      }
    }
  ]
}
```

- `rules` — A JSON Logic rule object. The `var` references within refer to keys in the **resolved** `state` object.
- `state` — A mapping from local variable names (used in `rules`) to state references. Values use the braced `{$moduleData.key}` format.

### Evaluation Flow

1. For each condition in the array, resolve `state` values from module/screen state.
2. Pass the resolved state as the data context to JSON Logic.
3. Evaluate the `rules` against the resolved data.
4. **ALL** conditions must evaluate to `true` (AND logic across the array).

### Example: Show element only when goals exist

```json
{
  "conditions": [
    {
      "rules": {
        "and": [
          { "!=": [{ "var": "goals" }, null] },
          { "!=": [{ "var": "goals" }, ""] }
        ]
      },
      "state": {
        "goals": "{$moduleData.goalTitles}"
      }
    }
  ]
}
```

How this works:
1. `{$moduleData.goalTitles}` resolves to the value stored in module state under `goalTitles`
2. The resolved value is assigned to the local variable `goals`
3. JSON Logic checks: `goals != null AND goals != ""`
4. If true, the element is shown (or the event/action executes)

### Supported JSON Logic Operators

Any standard JSON Logic operator is valid. Common ones:

| Operator | Example |
|----------|---------|
| `==`, `!=` | `{ "!=": [{ "var": "x" }, null] }` |
| `>`, `>=`, `<`, `<=` | `{ ">=": [{ "var": "score" }, 5] }` |
| `and`, `or`, `!` | `{ "and": [ ... ] }` |
| `in` | `{ "in": ["alcohol", { "var": "substances" }] }` |
| `var` | `{ "var": "keyName" }` — reads from condition `state` |

---

## 6. Element Conditions (Conditional Rendering)

Elements can be conditionally shown/hidden by adding a `conditions` array at the
element level. iOS evaluates these in `SDUIViewModel.shouldIncludeElement`.

```json
{
  "type": "spacer",
  "state": { "id": "goals_spacer" },
  "style": { "height": 24, "direction": "vertical", "isFlexible": false },
  "conditions": [
    {
      "rules": {
        "and": [
          { "!=": [{ "var": "goals" }, null] },
          { "!=": [{ "var": "goals" }, ""] }
        ]
      },
      "state": {
        "goals": "{$moduleData.goalTitles}"
      }
    }
  ]
}
```

### Rules

- If `conditions` is absent or empty, the element **always** renders.
- All conditions in the array must be true for the element to render.
- Condition `state` values MUST use the braced format `"{$moduleData.key}"`.
- The `rules` object uses standard JSON Logic syntax.

---

## 7. Events & Actions

### Event Structure

```json
{
  "id": "navigate_to_motivation",     ← unique event ID
  "type": "custom",                    ← event trigger type
  "conditions": [],                    ← optional gating conditions
  "action": [                          ← ordered list of actions
    {
      "type": "navigation",
      "deeplink": "motivation"
    }
  ]
}
```

### Event Types

| Type | When it fires |
|------|---------------|
| `onStart` | Screen appears for the first time |
| `onLoad` | Screen loads (including re-visits) |
| `onAppear` | Element becomes visible |
| `onSelected` | User taps a selectable element |
| `onSubmit` | Form submission |
| `onToggle` / `onToggleOn` / `onToggleOff` | Toggle state change |
| `onAnimationComplete` | Lottie animation finishes |
| `custom` | Triggered programmatically (by voice tool or code) |

### Action Types

| Type | Required Fields | Description |
|------|----------------|-------------|
| `navigation` | `deeplink` | Navigate to another screen. Deeplink is the screen ID or a full URL. |
| `stateUpdate` | `updates`, optional `scope` | Write values to screen or module state. |
| `toolCall` | `tool`, optional `params` | Trigger a named tool (e.g. `setVoiceEnabled`). |
| `serviceCall` | `serviceName`, `functionName` | Call a backend service. |
| `closeModule` | optional `flowCompleted` | Close the current module/journey. |

### Navigation Deeplinks

Deeplinks can be:
- A bare screen ID: `"motivation"` — navigates to the screen with `id: "motivation"`
- A full URL: `"https://links.pelagohealth.com/module-id/screen-id"` — the last path segment is extracted as the screen ID

---

## 8. System Tools

System tools are automatically injected by the server for all journeys. They are
available to the voice agent and handled client-side. **Do not redefine these in
agent `tools[]` — they are added automatically.**

### trigger_event

Navigates between screens by firing a named event.

```
trigger_event({ eventId: "navigate_to_motivation", delay?: 2 })
```

- `eventId` must match an event `id` on the current screen or its elements.
- `delay` (optional) — seconds to wait before firing.

### record_input

Captures user input and stores it in module state.

```
record_input({ title, summary, description?, storeKey?, nextEventId?, delay? })
```

- `storeKey` — if provided, stores `summary` into `moduleState[storeKey]`.
- `nextEventId` — if provided, auto-triggers that event after delay.

### set_goals

Captures structured goals and stores them in module state.

```
set_goals({ goals: [{ goal: string, categories: string[], progress: number }] })
```

- Stores `goalTitles` (string array) and `memberGoals` (full objects) in module state.
- `goalTitles` is what the `checklistCard` element reads via `{$moduleData.goalTitles}`.
- Valid categories: `health`, `relationships`, `emotional_wellbeing`, `financial`, `habits`, `personal_growth`, `mindfulness`.
- `progress` should be `0` at intake.

### capture_weekly_focus

Captures the member's weekly focus and optionally links it to a goal.

```
capture_weekly_focus({ focus: string, relatedGoal?: string })
```

- Stores `weeklyFocus` (quoted string), `weeklyFocusGoal` (string or null), and
  `weeklyFocusCaption` (auto-generated date attribution) in module state.
- The `quoteCard` element reads `{$moduleData.weeklyFocus}` and `{$moduleData.weeklyFocusCaption}`.

### set_reminder_time

```
set_reminder_time({ time: string })
```

### set_checkin_frequency

```
set_checkin_frequency({ days: number })
```

### end_call

```
end_call({ reason?: string, delaySeconds?: number })
```

---

## 9. Element Types & Data Contracts

Every element has `type`, `state` (data), optional `style`, optional `events`,
and optional `conditions`. The `state` object **always** includes an `id` field.

### Supported Element Types

| Type | `state` fields | `style` fields |
|------|---------------|----------------|
| `textBlock` | `id`, `text` | `style` (heading1–caption), `alignment`, `color` |
| `button` | `id`, `title`, `isDisabled?` | `style` (primary/secondary/tertiary/alert), `size` |
| `image` | `id`, `imageName` | `width?`, `height?`, `contentMode?` |
| `spacer` | `id` | `width?`, `height?`, `direction`, `isFlexible` |
| `checklistCard` | `id`, `title`, `itemTitles` | `backgroundColor?`, `cornerRadius?` |
| `openQuestion` | `id`, `question` | — |
| `largeQuestion` | `id`, `title`, `options[]`, `storeKey?` | — |
| `checkboxButton` | `id`, `title`, `option`, `isSelected?` | `height?` |
| `chipsGroup` | `id`, `options[]`, `maxSelection` | — |
| `imageCard` | `id`, `title`, `description` | `imageName`, `imageWidth?`, `imageHeight?`, `backgroundColor?`, `cornerRadius?` |
| `textCard` | `id`, `title`, `description?`, `body?` | `backgroundColor?`, `cornerRadius?` |
| `toggleCard` | `id`, `title`, `description?`, `label?`, `isToggled` | `icon?`, `backgroundColor?`, `borderColor?`, `cornerRadius?` |
| `quoteCard` | `id`, `message`, `caption?` | `imageName?` |
| `careCall` | `id`, `reason`, `time`, `participant`, `duration`, `callType`, `ctaTitle` | `backgroundColor?` |
| `animatedImage` | `id`, `animationName`, `autoPlay?`, `loop?` | `width?`, `height?` |
| `animatedComponents` | `id`, `components[]` | — |
| `loadingView` | `id` | — |
| `circularStepper` | `id`, `currentStep`, `totalSteps` | — |
| `miniWidget` | `id`, `title`, `subtitle?`, `iconName?` | — |
| `weekCheckinSummary` | `id`, `data` | — |
| `agentMessageCard` | `id`, `message` | `backgroundColor?` |
| `orb` | `id` | `size?` |
| `imageCarousel` | `id`, `images[]` | `scrollSpeed?`, `cardHeight?`, `gap?`, `pauseOnHover?` |
| `imageCheckboxButton` | `id`, `title`, `option`, `imageName` | `height?` |

### checklistCard — Dynamic Data Binding

`itemTitles` can be:
- **Static**: `["Goal 1", "Goal 2"]` — a literal JSON array of strings
- **Dynamic**: `"{$moduleData.goalTitles}"` — a state reference that resolves to `string[]`

On iOS, this uses `ResolvableValue<[String]>` which supports both forms. The value
must be a real `[String]` array in state — not a comma-joined string.

### largeQuestion — storeKey

When `storeKey` is set, the selected option ID is automatically stored into
`moduleState[storeKey]` when the user taps an option and triggers an event.

---

## 10. Prompt–Screen Alignment

Voice agent prompts reference screens and events. These references **must** stay in sync.

### Rules

1. Every screen ID mentioned in a prompt must exist in the journey JSON.
2. Every `eventId` referenced in prompt tool-call instructions must exist as an
   event `id` on the corresponding screen or its elements.
3. Navigation table event names must match the JSON event IDs exactly.
4. `trigger_event` calls in the prompt must use the exact `eventId` from the JSON.
5. `screenPrompts` keys must map to existing screen IDs.

### Prompt Format for Screen Instructions

```
## SCREEN: outcomes
Available Events: navigate_to_voice_motivation
Purpose: ...
Instructions: ...
```

The `## SCREEN: <id>` format is parsed by the import/export system and used for
screen-level prompt delivery to the voice agent.

---

## 11. Recipes: Common Patterns

### Conditional Open-Question-to-Answer Pattern

Shows an `openQuestion` element initially, then replaces it with an "answer" element when data is captured.
Uses **inverse conditions** on sibling elements sharing the same state variable.

**How it works:**
1. The `openQuestion` element has a condition that makes it visible only when the state key is `null` or `""`.
2. A sibling answer element (e.g. `quoteCard`, `checklistCard`) has the inverse condition — visible when the state key is **not** `null` and **not** `""`.
3. A tool call (e.g. `capture_weekly_focus`, `set_goals`) populates the module state key.
4. The conditions re-evaluate, hiding the question and showing the answer.

**Template — openQuestion (visible when empty):**
```json
{
  "type": "openQuestion",
  "state": { "id": "my_question", "question": "What would you like to focus on?" },
  "conditions": [{
    "rules": { "or": [
      { "==": [{ "var": "answer" }, null] },
      { "==": [{ "var": "answer" }, ""] }
    ]},
    "state": { "answer": "{$moduleData.myAnswerKey}" }
  }]
}
```

**Template — answer element (visible when populated):**
```json
{
  "type": "quoteCard",
  "state": {
    "id": "my_answer",
    "message": "{$moduleData.myAnswerKey}",
    "caption": "{$moduleData.myAnswerCaption}"
  },
  "conditions": [{
    "rules": { "and": [
      { "!=": [{ "var": "answer" }, null] },
      { "!=": [{ "var": "answer" }, ""] }
    ]},
    "state": { "answer": "{$moduleData.myAnswerKey}" }
  }]
}
```

**Key rules:**
- Both elements reference the **same** state variable name (e.g. `"answer"`) in their condition `state` block.
- The `state` block maps this variable to the **same** module data key (e.g. `{$moduleData.myAnswerKey}`).
- The answer element can be **any** element type — `quoteCard`, `checklistCard`, `textBlock`, etc.
- You can add a `spacer` element between them with the same "show when populated" condition.

**Real example — weekly focus screen:**
The `weekly-focus` screen in `intake_call_journey.json` uses this pattern with `openQuestion` + `quoteCard`.

---

## 12. Common Mistakes & Guardrails

### DO NOT

| Mistake | Why it breaks |
|---------|--------------|
| Use `"data"` instead of `"state"` for element properties | iOS decodes from `state` key. `data` is ignored. |
| Omit `"id"` from element `state` | iOS elements require `id` for identity and accessibility. |
| Use unbraced references in conditions: `"$moduleData.key"` | iOS `resolveVariable` requires braces: `"{$moduleData.key}"`. |
| Store arrays as comma-joined strings | `ResolvableValue<[String]>` needs a real `[String]` array, not `"a,b,c"`. |
| Use made-up element types | iOS `ElementType` enum will fail to decode. Only use types listed above. |
| Duplicate screen IDs | Navigation will break — first match wins. |
| Reference non-existent event IDs in prompts | `trigger_event` will fail with "event not found". |
| Add `tools` to ElevenLabs SDK overrides | Only `prompt` and `voiceId` are supported. Tools must be configured in the dashboard. |
| Omit `conditions: []` on events | iOS decodes `conditions` as required (non-optional) on events. Use `[]` for no conditions. |
| Use `jobTitle` for quoteCard | Renamed to `caption`. iOS decoder supports both for backward compat, but new JSON must use `caption`. |

### DO

| Practice | Why |
|----------|-----|
| Always include `"conditions": []` on screen and element events | iOS requires this field in the JSON. |
| Use `"{$moduleData.key}"` with braces for all state references | Both iOS and web strip braces before resolving. |
| Store arrays as native arrays in module state | `checklistCard`, `ResolvableValue`, and condition evaluation all expect native types. |
| Keep event IDs unique within a screen | Prevents ambiguous event matching. |
| Match prompt event references to JSON event IDs exactly | The voice agent calls `trigger_event` with the ID from the prompt. |
| Use `section.position: "body"` for scrollable content | `fixed-top` and `fixed-bottom` don't scroll. |
| Test conditional elements by setting module state manually | Verify conditions evaluate correctly before deploying. |

---

## Appendix: File Locations

| File | Purpose |
|------|---------|
| `apps/web/src/types/journey.ts` | Canonical TypeScript type definitions |
| `apps/web/src/contexts/voiceAgent/ScreenContext.tsx` | Web state management, interpolation, condition evaluation |
| `apps/web/src/components/voiceAgent/ScreenPreview.tsx` | Web element rendering with interpolation |
| `apps/web/src/pages/VoiceAgent.tsx` | ElevenLabs tool handlers (set_goals, capture_weekly_focus, etc.) |
| `apps/web/src/lib/voiceAgent/journeyRuntime.ts` | Azure/OpenAI tool handlers (set_goals, capture_weekly_focus, etc.) |
| `server/routes/mobile.ts` | System tool schemas, mobile API |
| `server/utils/moduleNormalize.ts` | Journey → iOS module transformation |
| `assets/journeys/*.json` | Journey JSON definitions |
| `assets/prompts/*.txt` | Voice agent prompt templates |

### iOS Counterparts

| iOS File | Purpose |
|----------|---------|
| `EventStateManager.swift` | Module/screen state, variable resolution |
| `EventProcessor.swift` | Event condition evaluation, action execution |
| `EventSystem.swift` | Event/action/condition type definitions |
| `Element.swift` | Element type enum, AnyElement decoder |
| `ResolvableValue.swift` | Static-or-reference value decoder |
| `SDUIViewModel.swift` | Element condition filtering |
| `VoiceIntakeViewModel.swift` | Voice tool call handlers |
| `CheckListCardElement.swift` | Checklist card rendering with state resolution |
