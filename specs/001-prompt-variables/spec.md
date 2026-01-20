# Feature Specification: Prompt Variable System

**Feature Branch**: `001-prompt-variables`
**Created**: 2025-01-19
**Status**: Draft
**Input**: Template variable system for prompt editors with visibility, validation, and autocomplete

## Problem Statement

Currently, the System Prompt Editor and Agent Prompt Editor are plain textareas with no awareness of template variables (`{{variableName}}`). Users must:
- Remember which variables are available (memberName, primaryGoal, etc.)
- Manually type variable syntax without help
- Hope they spelled variables correctly with no validation
- Edit PQ Data separately on the VoiceAgent page, disconnected from Journey Builder

This leads to errors, frustration, and broken prompts at runtime.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Available Variables (Priority: P1)

A prompt author is editing the system prompt and wants to know which template variables they can use. They see a list of available variables with descriptions, and can click to insert them into the prompt.

**Why this priority**: Without knowing what's available, users can't effectively use the templating system. This is foundational.

**Independent Test**: Open prompt editor, verify variable list is visible with descriptions.

**Acceptance Scenarios**:

1. **Given** the System Prompt Editor is open, **When** user views the editor, **Then** a panel shows all available variables with names and descriptions
2. **Given** the variable panel, **When** user clicks a variable, **Then** it is inserted at the cursor position in the format `{{variableName}}`
3. **Given** the Agent Prompt Editor, **When** user views it, **Then** the same variable panel is available

---

### User Story 2 - Variable Autocomplete (Priority: P1)

A prompt author types `{{` in the editor and wants to quickly find and insert the right variable. An autocomplete dropdown appears showing matching variables as they type.

**Why this priority**: Typing `{{memberName}}` manually is error-prone. Autocomplete prevents typos and speeds up editing.

**Independent Test**: Type `{{` in editor, verify dropdown appears with variable options.

**Acceptance Scenarios**:

1. **Given** the prompt editor, **When** user types `{{`, **Then** an autocomplete dropdown appears with all available variables
2. **Given** the autocomplete is open, **When** user continues typing (e.g., `{{mem`), **Then** the list filters to matching variables
3. **Given** filtered results, **When** user selects a variable (click or Enter), **Then** the complete variable syntax is inserted (e.g., `{{memberName}}`)
4. **Given** the autocomplete is open, **When** user presses Escape, **Then** the dropdown closes without inserting

---

### User Story 3 - Variable Syntax Highlighting (Priority: P2)

A prompt author wants to visually distinguish template variables from regular text. Variables are highlighted with a distinct style so they're easy to spot and verify.

**Why this priority**: Visual distinction helps authors scan prompts quickly and catch errors. Important but not blocking.

**Independent Test**: Add a variable to prompt, verify it renders with distinct styling.

**Acceptance Scenarios**:

1. **Given** a prompt containing `{{memberName}}`, **When** displayed in the editor, **Then** the variable is visually highlighted (different background/color)
2. **Given** a valid variable, **When** highlighted, **Then** it shows in a success color (e.g., green/blue)
3. **Given** an invalid variable (e.g., `{{unknownVar}}`), **When** highlighted, **Then** it shows in an error color (e.g., red/orange)

---

### User Story 4 - Variable Validation (Priority: P2)

A prompt author has typed a variable incorrectly or used one that doesn't exist. The editor shows a warning so they can fix it before saving.

**Why this priority**: Prevents runtime errors from broken prompts. Catches mistakes early.

**Independent Test**: Type invalid variable, verify error indicator appears.

**Acceptance Scenarios**:

1. **Given** a prompt with `{{invalidVariable}}`, **When** the editor validates, **Then** a warning indicator appears on that variable
2. **Given** validation warnings exist, **When** user hovers over the warning, **Then** a tooltip explains the issue ("Unknown variable: invalidVariable")
3. **Given** a prompt with warnings, **When** user tries to save, **Then** a confirmation dialog warns about potential issues
4. **Given** all variables are valid, **When** user saves, **Then** no warnings are shown

---

### User Story 5 - Define Journey Variables (Priority: P3)

A prompt author wants to define custom variables specific to this journey, beyond the default PQ Data fields. They can add, edit, and remove variables that will be available in all prompts for this journey.

**Why this priority**: Enables customization without code changes. Power feature for advanced users.

**Independent Test**: Add a custom variable in journey settings, verify it appears in autocomplete.

**Acceptance Scenarios**:

1. **Given** the Journey Builder, **When** user opens "Variables" settings, **Then** they see a list of all variables (default + custom)
2. **Given** the variables panel, **When** user clicks "Add Variable", **Then** they can define name, description, and default value
3. **Given** a custom variable exists, **When** editing prompts, **Then** the custom variable appears in autocomplete and variable list
4. **Given** a custom variable is used in prompts, **When** user tries to delete it, **Then** a warning shows which prompts use it

---

### Edge Cases

- What happens if variable syntax is malformed (e.g., `{{memberName` without closing)?
  - Show as plain text, no highlighting, but indicate potential syntax error
- What if a variable name contains spaces (e.g., `{{member name}}`)?
  - Mark as invalid - variable names must be camelCase with no spaces
- What happens with nested braces (e.g., `{{{memberName}}}`)?
  - Match innermost valid pattern, mark extra braces as plain text
- How to handle very long variable lists (20+ variables)?
  - Group by category (Member, Goals, Preferences, Custom) with collapsible sections

## Requirements *(mandatory)*

### Functional Requirements

**Variable Display:**
- **FR-001**: System MUST display available variables in a panel within prompt editors
- **FR-002**: Each variable MUST show name, description, and example value
- **FR-003**: Variables MUST be grouped by category (Member Info, Goals, Preferences, Custom)
- **FR-004**: Clicking a variable MUST insert it at cursor position

**Autocomplete:**
- **FR-005**: System MUST show autocomplete dropdown when user types `{{`
- **FR-006**: Autocomplete MUST filter results as user types
- **FR-007**: Autocomplete MUST support keyboard navigation (up/down arrows, Enter to select, Escape to close)
- **FR-008**: Selected variable MUST be inserted with complete syntax including closing `}}`

**Syntax Highlighting:**
- **FR-009**: Valid variables MUST be visually distinct from regular text
- **FR-010**: Invalid/unknown variables MUST be highlighted differently (error state)
- **FR-011**: Highlighting MUST update in real-time as user types

**Validation:**
- **FR-012**: System MUST validate all `{{variableName}}` patterns against known variables
- **FR-013**: Invalid variables MUST show warning indicator
- **FR-014**: Hover on warning MUST show tooltip with error details
- **FR-015**: Save action MUST warn if validation errors exist

**Journey Variables:**
- **FR-016**: Journey MUST support custom variable definitions
- **FR-017**: Custom variables MUST have name, description, and default value
- **FR-018**: Custom variables MUST appear in autocomplete and variable panels
- **FR-019**: Deleting a used variable MUST show usage warning

### Key Entities

- **Variable**: A template placeholder with name (camelCase), description, category, and optional default value
- **VariableSet**: Collection of variables available for a journey (default PQData + custom)
- **VariableUsage**: Tracks which variables are used in which prompts (for dependency checking)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can insert a variable in under 3 seconds using autocomplete
- **SC-002**: 100% of invalid variables are detected and highlighted before save
- **SC-003**: Zero runtime errors from typos in variable names after feature launch
- **SC-004**: 90% of users discover and use autocomplete without documentation
- **SC-005**: Variable panel shows all available variables within 100ms of editor open

## Assumptions

- Current PQData fields remain the default variable set
- Variable substitution logic (`substitutePromptVariables`) remains unchanged
- Prompt editors remain textarea-based (not full code editors like Monaco)
- Journey-level custom variables are stored in the Journey object
