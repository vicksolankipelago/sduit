# Data Model: Prompt Variable System

**Feature**: 001-prompt-variables
**Date**: 2025-01-19

## Entities

### Variable

A template placeholder that can be used in prompts.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | camelCase identifier (e.g., "memberName") |
| `description` | string | Yes | Human-readable description |
| `category` | VariableCategory | Yes | Grouping for display |
| `defaultValue` | string | No | Default value for custom variables |
| `isCustom` | boolean | Yes | true if user-defined, false if built-in |

**Validation Rules**:
- `name` must be camelCase (regex: `/^[a-z][a-zA-Z0-9]*$/`)
- `name` must be unique within a journey
- `description` must be non-empty (1-200 characters)
- `category` must be a valid VariableCategory

### VariableCategory (enum)

| Value | Description |
|-------|-------------|
| `member` | Member information (name, acuity, substance) |
| `goals` | Goals and motivations |
| `preferences` | Care and support preferences |
| `context` | Conversation context data |
| `custom` | User-defined variables |

### VariableValidationResult

Result of validating a prompt for variable usage.

| Field | Type | Description |
|-------|------|-------------|
| `isValid` | boolean | true if all variables are valid |
| `variables` | VariableMatch[] | List of all variable occurrences |

### VariableMatch

A single variable occurrence in a prompt.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Variable name (without braces) |
| `position` | { start: number, end: number } | Character positions in text |
| `isValid` | boolean | true if variable exists |
| `error` | string? | Error message if invalid |

---

## Journey Extension

The existing `Journey` interface is extended:

```typescript
interface Journey {
  // ... existing fields ...

  customVariables?: Variable[];  // NEW
}
```

**Migration**: No migration needed. Field is optional, defaults to empty array.

---

## Default Variables

Built-in variables derived from `PQData`:

| Name | Category | Description |
|------|----------|-------------|
| `memberName` | member | Member's first name |
| `mainSubstance` | member | Primary substance of focus |
| `acuityLevel` | member | Member acuity (low/moderate/high) |
| `primaryGoal` | goals | Member's stated primary goal |
| `motivation` | goals | What motivates the member |
| `learningTopics` | goals | Topics member wants to learn |
| `personalizedApproach` | preferences | Preferred support approach |
| `carePreferences` | preferences | Care style preferences |
| `drinkingLogs` | context | Recent drinking log data |
| `allQuestionsAndAnswers` | context | Full Q&A history |

---

## Relationships

```
Journey 1 ──────┬────── * Variable (customVariables)
               │
               └────── 1 systemPrompt (uses variables)
               │
               └────── * Agent
                           │
                           └────── 1 prompt (uses variables)
```

---

## State Transitions

Variables have no state transitions - they are static definitions.

Validation happens:
1. On prompt edit (real-time highlighting)
2. On journey save (warning if invalid)
3. On journey export (blocking if invalid)
