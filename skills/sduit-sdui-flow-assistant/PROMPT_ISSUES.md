# Prompt Issues and Fixes

Use this log as a living memory for prompt quality in the intake flow.

## 2026-02-15 - Wrong-screen event retry after navigation

- Symptom: Agent called `next_step_event` again on `about-you`, producing `invalid_event_for_screen`.
- Root cause: Prompt did not strongly forbid reusing prior-screen navigation events after screen transition.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added sync rules: do not retry previous-screen events after movement; if `invalid_event_for_screen`, continue only with current screen events.
  - Added `pq-program-summary` rule: call `next_step_event` exactly once.
- Verification:
  - Should no longer see `trigger_event called: next_step_event` when `currentScreen` is `about-you`.

## 2026-02-15 - Stale nextEventId reused on later screen

- Symptom: On `weekly-focus`, agent called `record_input` with stale `nextEventId: navigate_to_weekly_focus`, causing navigation confusion.
- Root cause: Prompt lacked explicit constraint that `record_input.nextEventId` must belong to the current screen.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added rule: before `record_input(..., nextEventId=...)`, verify nextEventId exists on current screen; never reuse previous-screen nextEventId.
  - `apps/web/src/pages/VoiceAgent.tsx`
  - Added runtime safety: if `record_input.nextEventId` is not valid on current screen, skip auto-trigger and keep saved data.
- Verification:
  - Should no longer see stale `record_input` nextEventId causing wrong-screen trigger attempts.

## 2026-02-15 - Notification permission flow started from wrong screen

- Symptom: `permissions_screen_event` never appeared because model remained on `cm-rewards-intro` and called check-in/notification tools there.
- Root cause: Prompt sequencing allowed later-screen actions without hard current-screen preconditions and recovery behavior.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added preconditions for `checkin-commitment` and `pq-notification-setup`.
  - Added recovery instructions: if still on `cm-rewards-intro`, first trigger `navigate_to_checkin_commitment` and wait.
  - Added rule: on `invalid_event_for_screen`, do not continue that step.
- Verification:
  - Should see successful `navigate_to_checkin_commitment` before any `select_*_commitment`.
  - `permissions_screen_event` should only be called when `current_screen` is `pq-notification-setup`.

## 2026-02-15 - Plan-review script spoken before plan screen was visible

- Symptom: Agent spoke plan-review lines ("Based on what you've told me...") before user could see `pq-plan-review` summary UI.
- Root cause: Prompt did not gate plan-review language behind confirmed `current_screen = pq-plan-review`.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added handoff rule after `navigate_to_plan_review`: stop and wait for screen confirmation.
  - Added explicit `pq-plan-review` precondition for all plan-review lines.
- Verification:
  - Plan-review script should only occur after successful transition to `pq-plan-review`.

## 2026-02-15 - Premature goal capture from acknowledgement-style reply

- Symptom: Agent moved to "Here is what I've captured" without collecting substantive outcomes content.
- Root cause: Prompt allowed ambiguous interpretation of acknowledgements as full answers.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added "Substantive-response rule" globally.
  - Added outcomes-specific rule: never call `set_goals` from acknowledgement-only replies; ask follow-up first.
- Verification:
  - After replies like "yeah/ok/sounds good", agent should ask a follow-up before calling `set_goals`.

## 2026-02-16 - Goals UI shown before outcomes answer

- Symptom: On `outcomes`, `set_goals` was called before a real outcomes answer, so checklist UI appeared before the user answered the goals question.
- Root cause: Outcomes instructions were not explicit enough about strict ask→wait→set_goals sequencing.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added strict sequence block: ask question first, stop, wait for substantive answer, only then call `set_goals`.
  - Added explicit prohibition on calling `set_goals` for silence/ellipsis/empty turns.
  - Strengthened follow-up rule for unclear/missing/ack-only responses.
- Verification:
  - No `set_goals called` should appear before a substantive outcomes user utterance.
  - "Here is what I've captured..." should occur only after `set_goals` is called from a substantive answer.

## 2026-02-16 - Weekly focus skipped due premature navigation attempt

- Symptom: Agent called `navigate_to_cm_rewards_intro` before collecting weekly focus, then started rewards/check-in prompts while still on `weekly-focus`.
- Root cause: Prompt did not force ask→capture→record ordering strongly enough, and did not handle "navigation scheduled but screen unchanged" (event conditions unmet) as a non-advance.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added weekly-focus strict sequencing block: ask question, wait, call `capture_weekly_focus`, call `record_input`, then navigate.
  - Added explicit rule: if `navigate_to_cm_rewards_intro` does not actually advance screen, remain in weekly-focus flow and do not start rewards/check-in script.
  - Added global rule: treat "trigger_event success + unchanged current_screen" as not advanced.
- Verification:
  - No rewards/check-in language should appear while `current_screen` is `weekly-focus`.
  - `navigate_to_cm_rewards_intro` should only be followed by rewards script after confirmed screen change to `cm-rewards-intro`.

## 2026-02-16 - Plan review completion triggered without explicit positive approval

- Symptom: Journey could finish after any non-empty confirmation on `pq-plan-review`, even when the member was not clearly approving.
- Root cause: Completion event condition only checked `planReviewConfirmation` for non-empty value; prompt did not require a strict positive token.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Updated `pq-plan-review` behavior to only navigate on explicit positive response and store `planReviewApproval = "approved"`.
  - Added non-positive branch to remain on plan-review with `planReviewApproval = "not_approved"` and no navigation.
  - `assets/journeys/intake_call_journey.json`
  - Updated `navigate_to_completion` event condition to require `{$moduleData.planReviewApproval} == "approved"`.
  - Synced `screenPrompts.pq-plan-review` to the same approval-gated behavior.
- Verification:
  - No completion navigation when member says no / unsure / change request.
  - Completion only occurs after a clearly positive response and `planReviewApproval` is set to `approved`.

## 2026-02-16 - Weekly focus captured from filler turn (question effectively skipped)

- Symptom: On `weekly-focus`, the UI card was populated and flow advanced without the member giving a real weekly focus answer (for example after filler like "cheers"/"thanks").
- Root cause: Prompt did not explicitly prohibit `capture_weekly_focus`/`record_input` on acknowledgement or filler turns.
- Fix applied:
  - `assets/prompts/intake_call_prompt.txt`
  - Added global capture-tool rule: never call `set_goals`, `capture_weekly_focus`, or `record_input` from acknowledgement/filler-only turns.
  - Added weekly-focus strict rule: if latest turn is filler (e.g., "yeah", "ok", "cheers", "..."), ask follow-up and remain on weekly-focus.
  - Added `capture_weekly_focus` tool-level prohibition for filler turns.
  - Added recovery rule: if captured by mistake from non-substantive turn, re-ask weekly-focus and do not proceed.
- Verification:
  - No `capture_weekly_focus` call should occur from filler-only turns.
  - Weekly-focus question should be asked and answered substantively before card render + navigation.
