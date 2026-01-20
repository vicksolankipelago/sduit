# SDUI Journey Builder Constitution

## Core Principles

### I. Config-Driven Architecture
All UI flows MUST be defined as structured configuration files. The system generates syntactically valid SDUI configs that can be consumed by any compliant renderer. No hardcoded UI logic - everything is declarative and portable.

**Rules:**
- Flows defined in JSON/YAML config format
- Schema validation on all config outputs
- Configs must be version-controlled and diffable
- Runtime interprets configs, never generates UI directly

### II. Design Excellence
The flow editor UI MUST be beautifully designed and intuitive. This is a design tool - it must inspire confidence and creativity. Pelago design system compliance is mandatory.

**Rules:**
- Follow Pelago design system (ES Rebond Grotesque, Suisse Neue fonts)
- Consistent spacing, typography, and color usage
- Micro-interactions and visual feedback for all actions
- Accessibility standards (WCAG 2.1 AA minimum)

### III. Preview-First Development
Users MUST always see what they're building. Real-time preview is non-negotiable. The gap between editing and experiencing should be zero.

**Rules:**
- Live preview updates on every change
- Toggle between voice and visual preview modes
- Preview must match production rendering exactly
- Support device frame previews (mobile, tablet, desktop)

### IV. Voice & Visual Parity
Voice flows and non-voice flows are equal citizens. The system MUST support both interaction modes with the same underlying config structure.

**Rules:**
- Single config format supports both voice and visual flows
- Voice prompts and visual components defined together
- Test runner supports both modes
- Seamless switching between voice and tap interactions

### V. Type Safety & Validation
All configs MUST be syntactically correct and type-safe. Invalid configs should be impossible to save or export.

**Rules:**
- TypeScript throughout the codebase
- JSON Schema validation for all config files
- Real-time validation feedback in editor
- Generated TypeScript types from config schemas

## Tech Stack Constraints

**Frontend:**
- React 19 with Vite
- React Router 7
- TypeScript (strict mode)
- Pelago design system

**Backend:**
- Express.js / Node.js
- Supabase (auth + database)
- Azure OpenAI (voice/realtime)
- AWS Bedrock (AI generation)

**Architecture:**
- Monorepo with npm workspaces
- Apps: `web` (editor), `api` (backend)
- Packages: `shared` (types, utils)

## Development Workflow

**Commits:**
- JIRA ticket format: `[POLICE-XXX] type: description`
- Types: feat, fix, refactor, docs, test, chore

**Code Quality:**
- TypeScript strict mode enforced
- ESLint + Prettier for formatting
- Component-driven development
- Shared types between frontend and backend

**Testing:**
- Unit tests for config validation logic
- Integration tests for API endpoints
- Visual regression tests for UI components
- E2E tests for critical user flows

## Governance

This constitution defines the non-negotiable principles for SDUI Journey Builder. All features, PRs, and architectural decisions MUST align with these principles.

**Amendment Process:**
1. Propose change with rationale
2. Document impact on existing code
3. Update dependent specs and plans
4. Version bump according to semver

**Compliance:**
- All PRs must verify principle alignment
- Code review checklist includes constitution check
- Quarterly review of principles for relevance

**Version**: 1.0.0 | **Ratified**: 2025-01-19 | **Last Amended**: 2025-01-19
