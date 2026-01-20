# Tasks: Prompt Variable System

**Input**: Design documents from `/specs/001-prompt-variables/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested - test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend**: `apps/web/src/`
- Components: `apps/web/src/components/voiceAgent/`
- Hooks: `apps/web/src/hooks/`
- Utils: `apps/web/src/utils/`
- Types: `apps/web/src/types/`

---

## Phase 1: Setup

**Purpose**: Create base types and infrastructure for variable system

- [ ] T001 Create Variable types in `apps/web/src/types/variables.ts`
- [ ] T002 [P] Add DEFAULT_VARIABLES array to `apps/web/src/utils/promptTemplates.ts`
- [ ] T003 [P] Add `customVariables` field to Journey interface in `apps/web/src/types/journey.ts`
- [ ] T004 Create `useVariables` hook in `apps/web/src/hooks/useVariables.ts`

**Checkpoint**: Variable type system ready

---

## Phase 2: Foundational

**Purpose**: Core utilities that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Add `validatePromptVariables()` function to `apps/web/src/utils/promptTemplates.ts`
- [ ] T006 Add `extractVariablesFromText()` function to `apps/web/src/utils/promptTemplates.ts`
- [ ] T007 Create CSS file `apps/web/src/components/voiceAgent/VariablePanel.css`
- [ ] T008 [P] Create CSS file `apps/web/src/components/voiceAgent/PromptTextarea.css`

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - See Available Variables (Priority: P1) 🎯 MVP

**Goal**: Display available variables in a panel within prompt editors, clickable to insert

**Independent Test**: Open SystemPromptEditor, verify variable list visible, click to insert `{{memberName}}`

### Implementation for User Story 1

- [ ] T009 [US1] Create `VariablePanel` component in `apps/web/src/components/voiceAgent/VariablePanel.tsx`
- [ ] T010 [US1] Implement category grouping (Member, Goals, Preferences, Custom) in VariablePanel
- [ ] T011 [US1] Add click-to-insert functionality to VariablePanel
- [ ] T012 [US1] Integrate VariablePanel into `apps/web/src/components/voiceAgent/SystemPromptEditor.tsx`
- [ ] T013 [US1] Integrate VariablePanel into `apps/web/src/components/voiceAgent/PromptEditor.tsx` (Agent prompts tab)
- [ ] T014 [US1] Style VariablePanel following Pelago design system

**Checkpoint**: Users can see and click-insert variables. MVP complete.

---

## Phase 4: User Story 2 - Variable Autocomplete (Priority: P1)

**Goal**: Show autocomplete dropdown when user types `{{` with filtering as they type

**Independent Test**: Type `{{mem` in prompt editor, verify dropdown shows matching variables, select to insert

### Implementation for User Story 2

- [ ] T015 [US2] Create `useVariableAutocomplete` hook in `apps/web/src/hooks/useVariableAutocomplete.ts`
- [ ] T016 [US2] Implement cursor position detection using mirror element technique
- [ ] T017 [US2] Create `VariableAutocomplete` component in `apps/web/src/components/voiceAgent/VariableAutocomplete.tsx`
- [ ] T018 [US2] Implement keyboard navigation (up/down arrows, Enter, Escape) in autocomplete
- [ ] T019 [US2] Add `{{` trigger detection to SystemPromptEditor textarea
- [ ] T020 [US2] Add `{{` trigger detection to PromptEditor textarea
- [ ] T021 [US2] Style autocomplete dropdown following Pelago design system

**Checkpoint**: Autocomplete works in both editors. Core editing experience complete.

---

## Phase 5: User Story 3 - Variable Syntax Highlighting (Priority: P2)

**Goal**: Visually distinguish variables from regular text with valid/invalid states

**Independent Test**: Add `{{memberName}}` (valid) and `{{unknownVar}}` (invalid) to prompt, verify different highlighting

### Implementation for User Story 3

- [ ] T022 [US3] Create `PromptTextarea` component with overlay technique in `apps/web/src/components/voiceAgent/PromptTextarea.tsx`
- [ ] T023 [US3] Implement text mirroring (transparent textarea + styled div)
- [ ] T024 [US3] Add variable highlighting with valid/invalid states
- [ ] T025 [US3] Integrate PromptTextarea into SystemPromptEditor (replace plain textarea)
- [ ] T026 [US3] Integrate PromptTextarea into PromptEditor (replace plain textarea)
- [ ] T027 [US3] Add CSS for valid variables (green highlight) and invalid variables (red wavy underline)

**Checkpoint**: Variables are visually distinct. Validation visible at-a-glance.

---

## Phase 6: User Story 4 - Variable Validation (Priority: P2)

**Goal**: Show warnings for invalid variables with save confirmation

**Independent Test**: Add invalid variable, verify warning icon, try to save, confirm warning dialog appears

### Implementation for User Story 4

- [ ] T028 [US4] Add validation state to PromptTextarea component
- [ ] T029 [US4] Create validation warning indicator component (icon + tooltip)
- [ ] T030 [US4] Add hover tooltip showing "Unknown variable: {name}"
- [ ] T031 [US4] Add validation check to JourneyBuilder save flow in `apps/web/src/components/voiceAgent/JourneyBuilder.tsx`
- [ ] T032 [US4] Create confirmation dialog for saving with validation warnings
- [ ] T033 [US4] Display validation error count in editor header

**Checkpoint**: Users warned before saving broken prompts.

---

## Phase 7: User Story 5 - Define Journey Variables (Priority: P3)

**Goal**: Allow users to define custom variables per journey

**Independent Test**: Add custom variable "coachName", verify it appears in autocomplete and panel

### Implementation for User Story 5

- [ ] T034 [US5] Create `CustomVariableEditor` component in `apps/web/src/components/voiceAgent/CustomVariableEditor.tsx`
- [ ] T035 [US5] Implement add/edit/delete for custom variables
- [ ] T036 [US5] Add custom variable section to VariablePanel
- [ ] T037 [US5] Add usage check before delete (warn if variable used in prompts)
- [ ] T038 [US5] Integrate CustomVariableEditor into JourneyBuilder (new "Variables" section)
- [ ] T039 [US5] Persist customVariables in Journey save/load flow
- [ ] T040 [US5] Include custom variables in autocomplete and validation

**Checkpoint**: Full variable system complete with customization.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements across all stories

- [ ] T041 [P] Add loading states for variable panel
- [ ] T042 [P] Add empty state for custom variables section
- [ ] T043 Accessibility: keyboard navigation for variable panel
- [ ] T044 Accessibility: ARIA labels for autocomplete
- [ ] T045 Performance: memoize variable filtering in autocomplete
- [ ] T046 Update SystemPromptEditor tips section to mention variables
- [ ] T047 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup
- **User Stories (Phase 3-7)**: All depend on Foundational
- **Polish (Phase 8)**: Depends on desired user stories

### User Story Dependencies

- **US1 (See Variables)**: After Foundational - no other story dependencies
- **US2 (Autocomplete)**: After Foundational - independent of US1
- **US3 (Highlighting)**: After Foundational - independent
- **US4 (Validation)**: After US3 (uses highlighting infrastructure)
- **US5 (Custom Variables)**: After US1 (extends VariablePanel)

### Parallel Opportunities

**Setup Phase:**
```
T002 [P] DEFAULT_VARIABLES || T003 [P] Journey.customVariables
```

**Foundational Phase:**
```
T007 [P] VariablePanel.css || T008 [P] PromptTextarea.css
```

**After Foundational, user stories can run in parallel:**
```
US1 (See Variables) || US2 (Autocomplete) || US3 (Highlighting)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T008)
3. Complete Phase 3: User Story 1 (T009-T014)
4. **STOP and VALIDATE**: Test variable panel independently
5. Deploy/demo - users can see and insert variables

### Recommended Order

1. **Setup + Foundational** → Types and utilities ready
2. **US1 (See Variables)** → MVP, immediate value
3. **US2 (Autocomplete)** → Core editing improvement
4. **US3 (Highlighting)** → Visual feedback
5. **US4 (Validation)** → Error prevention
6. **US5 (Custom Variables)** → Power user feature
7. **Polish** → Final touches

### Time Estimates (indicative)

| Phase | Tasks | Effort |
|-------|-------|--------|
| Setup | 4 | ~1 hour |
| Foundational | 4 | ~1 hour |
| US1 See Variables | 6 | ~2 hours |
| US2 Autocomplete | 7 | ~3 hours |
| US3 Highlighting | 6 | ~3 hours |
| US4 Validation | 6 | ~2 hours |
| US5 Custom Variables | 7 | ~3 hours |
| Polish | 7 | ~2 hours |
| **Total** | **47** | **~17 hours** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story independently testable after completion
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- MVP = Setup + Foundational + US1 (10 tasks, ~4 hours)
