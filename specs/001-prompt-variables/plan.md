# Implementation Plan: Prompt Variable System

**Branch**: `001-prompt-variables` | **Date**: 2025-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-prompt-variables/spec.md`

## Summary

Add template variable awareness to the System Prompt Editor and Agent Prompt Editor. Users will see available variables, get autocomplete suggestions when typing `{{`, see syntax highlighting for valid/invalid variables, and receive validation warnings before save. This builds on the existing `PQData` interface and `substitutePromptVariables` function.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19
**Primary Dependencies**: React, existing promptTemplates.ts, existing SystemPromptEditor.tsx
**Storage**: Journey object (localStorage + Supabase) - variables stored per-journey
**Testing**: Vitest for unit tests, React Testing Library for component tests
**Target Platform**: Web (Chrome, Safari, Firefox - modern browsers)
**Project Type**: Web application (monorepo)
**Performance Goals**: Autocomplete renders <100ms, highlighting updates <50ms per keystroke
**Constraints**: Must work with existing textarea-based editors (no Monaco/CodeMirror)
**Scale/Scope**: 10-20 default variables, up to 50 custom variables per journey

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Config-Driven** | ✅ PASS | Variables stored in Journey config, not hardcoded |
| **II. Design Excellence** | ✅ PASS | Must follow Pelago design system for variable panel UI |
| **III. Preview-First** | ✅ PASS | Real-time highlighting as user types |
| **IV. Voice & Visual Parity** | ✅ PASS | Variables work for both voice prompts and visual configs |
| **V. Type Safety** | ✅ PASS | Variables defined as TypeScript interfaces with validation |

**All gates pass.** Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-prompt-variables/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
apps/web/src/
├── components/
│   └── voiceAgent/
│       ├── SystemPromptEditor.tsx      # MODIFY: Add variable panel + autocomplete
│       ├── PromptEditor.tsx            # MODIFY: Add variable panel + autocomplete
│       ├── VariablePanel.tsx           # NEW: Reusable variable list component
│       ├── VariableAutocomplete.tsx    # NEW: Autocomplete dropdown component
│       └── PromptTextarea.tsx          # NEW: Enhanced textarea with highlighting
├── hooks/
│   └── useVariableAutocomplete.ts      # NEW: Autocomplete logic hook
├── utils/
│   └── promptTemplates.ts              # MODIFY: Add variable metadata + validation
└── types/
    └── journey.ts                      # MODIFY: Add custom variables to Journey type
```

**Structure Decision**: Frontend-only changes in `apps/web/src`. No backend changes required - variables are stored in the existing Journey object.

## Complexity Tracking

No violations to justify - implementation uses existing patterns and components.

---

## Phase 0: Research

### Research Tasks

1. **Textarea overlay techniques** - How to show syntax highlighting in a textarea without replacing it with a full code editor
2. **Autocomplete positioning** - Best practices for dropdown positioning relative to cursor in textarea
3. **Existing variable infrastructure** - Review PQData and substitutePromptVariables patterns

### Findings

**Decision 1: Textarea with overlay approach**
- **Chosen**: Use a transparent textarea on top of a styled div that mirrors content
- **Rationale**: Preserves native textarea behavior (selection, copy/paste, accessibility) while allowing styling
- **Alternatives rejected**:
  - Monaco Editor (too heavy, 1MB+ bundle)
  - contenteditable div (accessibility and selection issues)
  - Plain textarea with no highlighting (poor UX)

**Decision 2: Autocomplete positioning**
- **Chosen**: Use `getCaretCoordinates` library pattern to get cursor position, position dropdown absolutely
- **Rationale**: Works across browsers, handles scroll position, minimal code
- **Alternatives rejected**:
  - Fixed position dropdown (doesn't follow cursor)
  - Full-featured autocomplete library (overkill for simple variable list)

**Decision 3: Variable storage**
- **Chosen**: Store custom variables in `Journey.variables` array
- **Rationale**: Keeps variables with their journey, supports export/import
- **Alternatives rejected**:
  - Global variable store (loses journey context)
  - Separate API for variables (unnecessary complexity)

---

## Phase 1: Data Model

### Variable Interface

```typescript
// apps/web/src/types/variables.ts

export interface Variable {
  name: string;           // camelCase identifier (e.g., "memberName")
  description: string;    // Human-readable description
  category: VariableCategory;
  defaultValue?: string;  // Optional default for custom variables
  isCustom: boolean;      // true if user-defined
}

export type VariableCategory =
  | 'member'      // Member info (name, acuity)
  | 'goals'       // Goals and motivation
  | 'preferences' // Care preferences
  | 'context'     // Conversation context
  | 'custom';     // User-defined

export interface VariableValidationResult {
  isValid: boolean;
  variables: Array<{
    name: string;
    position: { start: number; end: number };
    isValid: boolean;
    error?: string;
  }>;
}
```

### Journey Type Extension

```typescript
// Extend existing Journey interface
export interface Journey {
  // ... existing fields ...

  customVariables?: Variable[];  // NEW: User-defined variables
}
```

### Default Variables (from PQData)

```typescript
export const DEFAULT_VARIABLES: Variable[] = [
  { name: 'memberName', description: 'Member\'s first name', category: 'member', isCustom: false },
  { name: 'mainSubstance', description: 'Primary substance of focus', category: 'member', isCustom: false },
  { name: 'acuityLevel', description: 'Member acuity level (low/moderate/high)', category: 'member', isCustom: false },
  { name: 'primaryGoal', description: 'Member\'s stated primary goal', category: 'goals', isCustom: false },
  { name: 'motivation', description: 'What motivates the member', category: 'goals', isCustom: false },
  { name: 'learningTopics', description: 'Topics member wants to learn about', category: 'goals', isCustom: false },
  { name: 'personalizedApproach', description: 'Preferred support approach', category: 'preferences', isCustom: false },
  { name: 'carePreferences', description: 'Care style preferences', category: 'preferences', isCustom: false },
  { name: 'drinkingLogs', description: 'Recent drinking log data', category: 'context', isCustom: false },
  { name: 'allQuestionsAndAnswers', description: 'Full Q&A history', category: 'context', isCustom: false },
];
```

---

## Phase 1: Component Design

### VariablePanel Component

```
┌─────────────────────────────────────┐
│ 📋 Available Variables              │
├─────────────────────────────────────┤
│ ▼ Member Info                       │
│   {{memberName}} - Member's name    │
│   {{acuityLevel}} - Acuity level    │
│   {{mainSubstance}} - Substance     │
├─────────────────────────────────────┤
│ ▼ Goals                             │
│   {{primaryGoal}} - Primary goal    │
│   {{motivation}} - Motivation       │
│   {{learningTopics}} - Topics       │
├─────────────────────────────────────┤
│ ▼ Preferences                       │
│   {{carePreferences}} - Pref...     │
│   {{personalizedApproach}} - App... │
├─────────────────────────────────────┤
│ ▼ Custom                            │
│   + Add Variable                    │
└─────────────────────────────────────┘
```

### PromptTextarea Component

```
┌─────────────────────────────────────────────────────────────┐
│ [Styled div - shows highlighted content]                    │
│                                                             │
│ You are speaking with {{memberName}} who wants to           │
│ {{primaryGoal}}. Their motivation is {{motivation}}.        │
│                                                  ▲          │
│ They mentioned {{unknownVar}} which is...       [error]     │
│                                                             │
│ [Transparent textarea on top - handles input]               │
└─────────────────────────────────────────────────────────────┘
```

### VariableAutocomplete Component

```
┌──────────────────────────────────┐
│ Typing: {{mem                    │
├──────────────────────────────────┤
│ > memberName - Member's name     │  ← highlighted
│   mainSubstance - Substance      │
└──────────────────────────────────┘
```

---

## Quickstart

### Adding Variable Support to an Editor

```typescript
import { PromptTextarea } from './PromptTextarea';
import { VariablePanel } from './VariablePanel';
import { useVariables } from '../hooks/useVariables';

function MyPromptEditor({ value, onChange, journey }) {
  const { variables, validate } = useVariables(journey);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (varName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = textarea.selectionStart;
    const before = value.slice(0, pos);
    const after = value.slice(pos);
    onChange(`${before}{{${varName}}}${after}`);
  };

  return (
    <div className="prompt-editor-with-variables">
      <PromptTextarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        variables={variables}
      />
      <VariablePanel
        variables={variables}
        onInsert={handleInsertVariable}
      />
    </div>
  );
}
```

### Validating Variables

```typescript
import { validatePromptVariables } from '../utils/promptTemplates';

const result = validatePromptVariables(promptText, availableVariables);

if (!result.isValid) {
  result.variables
    .filter(v => !v.isValid)
    .forEach(v => console.warn(`Invalid variable: ${v.name} at position ${v.position.start}`));
}
```

---

## Next Steps

Run `/speckit.tasks` to generate implementation tasks from this plan.
