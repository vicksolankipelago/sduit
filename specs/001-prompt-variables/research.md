# Research: Prompt Variable System

**Feature**: 001-prompt-variables
**Date**: 2025-01-19

## Research Questions

### 1. Textarea Syntax Highlighting

**Question**: How to show syntax highlighting in a textarea without using a heavy code editor?

**Decision**: Textarea overlay technique
- Transparent textarea positioned on top of a styled div
- Div mirrors textarea content with highlighting applied
- Textarea handles all input events
- Div handles visual rendering

**Rationale**:
- Preserves native textarea behavior (copy/paste, selection, IME)
- Maintains accessibility (screen readers work with textarea)
- Lightweight (<5KB additional code)
- No external dependencies required

**Alternatives Considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Monaco Editor | Full IDE features | 1MB+ bundle, overkill | ❌ |
| CodeMirror 6 | Lighter than Monaco | Still 200KB+, complex setup | ❌ |
| contenteditable | Native HTML | Selection bugs, a11y issues | ❌ |
| Plain textarea | Simple | No highlighting | ❌ |
| **Overlay technique** | Light, a11y, native | Manual sync needed | ✅ |

**Implementation Pattern**:
```css
.prompt-editor-container {
  position: relative;
}

.prompt-editor-highlight {
  /* Mirrors textarea exactly */
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  /* Same font, padding, etc as textarea */
}

.prompt-editor-textarea {
  position: relative;
  background: transparent;
  color: transparent;
  caret-color: black;
}
```

---

### 2. Cursor Position in Textarea

**Question**: How to get cursor pixel coordinates for autocomplete positioning?

**Decision**: Calculate from character position using hidden mirror element

**Rationale**:
- `textarea.selectionStart` gives character index
- Mirror element with same styling calculates pixel position
- Works across all browsers

**Implementation Pattern**:
```typescript
function getCaretCoordinates(textarea: HTMLTextAreaElement): { top: number; left: number } {
  const mirror = document.createElement('div');
  const style = getComputedStyle(textarea);

  // Copy relevant styles
  ['font', 'padding', 'border', 'width', 'lineHeight'].forEach(prop => {
    mirror.style[prop] = style[prop];
  });

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';

  const text = textarea.value.substring(0, textarea.selectionStart);
  mirror.textContent = text;

  const span = document.createElement('span');
  span.textContent = '|';
  mirror.appendChild(span);

  document.body.appendChild(mirror);
  const rect = span.getBoundingClientRect();
  document.body.removeChild(mirror);

  return { top: rect.top, left: rect.left };
}
```

---

### 3. Variable Detection Regex

**Question**: What regex pattern to use for detecting `{{variableName}}`?

**Decision**: `/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g`

**Rationale**:
- Matches `{{` opening
- Captures variable name (camelCase, starts with letter)
- Matches `}}` closing
- Global flag for multiple matches

**Edge Cases Handled**:
| Input | Behavior |
|-------|----------|
| `{{memberName}}` | ✅ Valid match |
| `{{member_name}}` | ❌ No match (underscores) |
| `{{123name}}` | ❌ No match (starts with number) |
| `{{memberName` | ❌ No match (unclosed) |
| `{{{memberName}}}` | Matches inner `{{memberName}}` |

---

### 4. Existing Infrastructure Review

**Question**: What exists in the codebase that we can build on?

**Findings**:

**PQData Interface** (`apps/web/src/utils/promptTemplates.ts`):
```typescript
export interface PQData {
  memberName: string;
  mainSubstance: string;
  acuityLevel: string;
  primaryGoal: string;
  motivation: string;
  learningTopics: string;
  personalizedApproach: string;
  carePreferences: string;
  drinkingLogs: string;
  allQuestionsAndAnswers: string;
}
```

**Substitution Function** (same file):
```typescript
export function substitutePromptVariables(prompt: string, pqData: Partial<PQData>): string
```

**Integration Points**:
1. `SystemPromptEditor.tsx` - Primary system prompt editor
2. `PromptEditor.tsx` - Agent-specific prompt editor
3. `JourneyBuilder.tsx` - Parent component, has journey state
4. `MemberPersonaEditor.tsx` - Edits PQData values (separate from Journey Builder)

**Gap Identified**: PQData values are edited on VoiceAgent page, not Journey Builder. Variables are used in Journey Builder but values come from elsewhere.

**Recommendation**: Keep this separation for now. Variable *definitions* in Journey, variable *values* in runtime context.

---

## Summary

All research questions resolved. Ready for Phase 1 implementation.

| Area | Decision | Risk |
|------|----------|------|
| Highlighting | Overlay technique | Low - proven pattern |
| Positioning | Mirror element | Low - standard approach |
| Detection | Regex pattern | Low - simple matching |
| Integration | Build on PQData | Low - existing patterns |
