/**
 * Post-Web Personalization Quiz (PQ) Journey
 * 
 * Voice intake flow that guides members through onboarding after completing the web PQ.
 * Based on iOS mobile app configuration.
 */

import { Journey, Agent, Screen } from '../../../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { loadIntakeCallPrompt } from '../../../utils/promptTemplates';
import { parsePromptText } from '../../../services/screenImport';

/**
 * Create the Post-Web PQ Journey with intake_call_prompt.txt content
 * Now async to load the prompt template from file
 */
export async function createPostWebPQJourney(): Promise<Journey> {
  // Load the intake call prompt from the template file
  let agentPrompt: string;
  let screenPrompts: Record<string, string> = {};
  
  try {
    agentPrompt = await loadIntakeCallPrompt();
    // Extract screen prompts from the loaded prompt file
    screenPrompts = parsePromptText(agentPrompt);
    console.log('✅ Loaded intake_call_prompt.txt for Intake Call journey');
    console.log(`✅ Extracted ${Object.keys(screenPrompts).length} screen prompts from prompt file`);
  } catch (error) {
    console.warn('⚠️ Failed to load intake_call_prompt.txt, using fallback prompt', error);
    // Fallback to basic prompt if template loading fails
    agentPrompt = `You are a warm, empathetic voice agent for Pelago, guiding new members through their onboarding journey.

## Voice and Tone
- Warm, steady, professional, calm
- Speak slowly, clearly, and with empathy
- Use member's name selectively — not every turn
- Avoid repeating yourself unless explicitly asked
- Plain, concise, member-friendly language
- Low, calm enthusiasm — encourage through clarity and care, not energy

## Response Guidelines
- Keep acknowledgments brief (2-3 words max)
- Flow naturally from one question to the next
- Don't pause between questions unless the user is clearly still speaking
- If the user gives a very short answer, gently encourage more detail before moving on
- Use varied acknowledgments; rotate through the phrases

## Acknowledgment Phrases (rotate; don't repeat consecutively)
- "Got it."
- "I hear you."
- "Appreciate that."
- "Thanks, noted."
- "Makes sense."
- "All set."

## Tool Call Rules
- You MUST issue a function call (not text) for each step as specified in screen prompts
- Do not describe the tool call in spoken content
- Tool calls are system actions only and never spoken aloud
- Make tool calls immediately after acknowledging the user's response
- Do not wait for tool results; continue the conversation
- Output order: tool call first, then speech`;
  }
  const agentId = uuidv4();
  
  const agent: Agent = {
    id: agentId,
    name: 'Voice Intake Agent',
    voice: 'shimmer', // Note: Voice is set at journey level, this is for backwards compatibility
    prompt: agentPrompt, // Use the loaded prompt template
    tools: [
      {
        id: 'trigger_event',
        name: 'trigger_event',
        description: 'Trigger a screen event to navigate between screens or select options in the UI. Use this to control the flow through different screens as specified in the screen prompts.',
        parameters: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'The ID of the event to trigger (e.g., "navigate_to_outcomes", "select_daily_commitment")',
            },
          },
          required: ['eventId'],
        },
      },
      {
        id: 'record_input',
        name: 'record_input',
        description: 'Captures and summarizes the user\'s input for a particular screen or section. Use this after the user has answered a question to record their response with a title and summary.',
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'A short title for the recorded input (e.g., "About You", "Motivation", "Intention")',
            },
            summary: {
              type: 'string',
              description: 'A one-line summary of what the user said',
            },
            description: {
              type: 'string',
              description: 'A short description providing more context about the user\'s response',
            },
          },
          required: ['title'],
        },
      },
    ],
    handoffs: [],
    handoffDescription: 'Voice intake agent that guides members through post-web PQ onboarding',
    position: { x: 100, y: 100 },
    screens: createPostWebPQScreens(),
    screenPrompts: screenPrompts, // Extract from prompt file instead of hardcoding
  };

  const journey: Journey = {
    id: uuidv4(),
    name: 'Intake Call',
    description: 'Complete voice-guided intake flow for members who have finished the web personalization quiz. Covers program review, deep dive questions, weekly intention, check-in commitment, and notification setup.',
    voice: 'shimmer', // Consistent voice across all agents
    systemPrompt: `### Language Requirement
**CRITICAL: You must ALWAYS respond in English. Never use any other language.**

### Voice Intake Flow Overview
**Goal:** Complete the intake process in a flowing conversation across multiple screens

**Flow Summary:**
1. **Welcome & Intro** - Greet member, confirm readiness
2. **Program Summary** - Show and summarize their personalized program
3. **Deep Dive Questions** - Collect context about their journey
4. **Intention & Commitment** - Set weekly focus and check-in goals
5. **Notification Setup** - Request permissions to stay on track

**Key Principle:** 
The program summary is shown EARLY (after intro) so members understand what they're getting before diving into detailed questions. This builds trust and context.

   **Member Context (Use for personalization):**
   - Member Name: Jack
   - Primary focus: Drink less and maintain a healthy lifestyle
   - Goals: Support behavior change through structured guidance
   - Current Check-in Streak: 7 days (User has logged drinks for the last 7 days consecutive)`,
    agents: [agent],
    startingAgentId: agentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  return journey;
}

function createPostWebPQScreens(): Screen[] {
  return [
    // Screen 1: pq-intro
    {
      id: 'pq-intro',
      title: 'Welcome',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'top_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
            {
              type: 'animatedImage',
              state: {
                id: 'welcome_animation',
                lottieName: 'COLOR_Pelago_Boat',
              },
              style: {
                width: 300,
                height: 300,
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'welcome_title',
                text: 'Welcome to Pelago',
              },
              style: {
                style: 'heading1',
                alignment: 'center',
                color: 'primary',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'mid_spacer',
              },
              style: {
                height: 16,
                width: null,
                isFlexible: false,
                direction: 'vertical',
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'setup_body',
                text: "Let's get you set up with a personalized plan",
              },
              style: {
                style: 'body1',
                alignment: 'center',
                color: 'secondary',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'bottom_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
          ],
        },
      ],
      events: [
        {
          id: 'navigate_to_about_you',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'pq-program-summary',
            },
          ],
        },
      ],
    },

    // Screen 2: pq-program-summary
    {
      id: 'pq-program-summary',
      title: 'Your program, based on what you shared',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'imageCard',
              state: {
                id: 'results_card',
                title: 'Welcome Jack!',
                description: 'Drink less and maintain a healthy lifestyle',
              },
              style: {
                imageName: 'Success',
                imageWidth: 72,
                imageHeight: 72,
                backgroundColor: 'card',
                cornerRadius: 16,
              },
            },
            {
              type: 'checklistCard',
              state: {
                id: 'next_steps_checklist',
                title: '',
                itemTitles: [
                  'Daily check-ins to track progress',
                  'Personalized insights and tips',
                  'Support from care team',
                  'Resources tailored to your goals',
                ],
              },
              style: {
                backgroundColor: 'backgroundLightTeaGreen',
                cornerRadius: 12,
              },
            },
            {
              type: 'quoteCard',
              state: {
                id: 'empty_appointment_quote',
                message: '"Our care team is here to give guidance based on your unique goals, whenever you are ready!"',
                jobTitle: 'Juliette, Pelago VP Care Team',
              },
              style: {
                imageName: null,
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'bottom_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
          ],
        },
      ],
      events: [
        {
          id: 'next_step_event',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'about-you',
            },
          ],
        },
      ],
    },

    // Screen 3: about-you
    {
      id: 'about-you',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'openQuestion',
              state: {
                id: 'about_you_question',
                question: 'What brings you to Pelago?',
              },
              style: {},
              events: [
                {
                  id: 'navigate_to_outcomes',
                  type: 'custom',
                  conditions: [],
                  action: [
                    {
                      type: 'navigation',
                      deeplink: 'outcomes',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      events: [
        {
          id: 'navigate_to_outcomes',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'outcomes',
            },
          ],
        },
      ],
    },

    // Screen 4: outcomes
    {
      id: 'outcomes',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'openQuestion',
              state: {
                id: 'outcomes_question',
                question: 'What would you like to achieve with Pelago?',
              },
              style: {},
              events: [
                {
                  id: 'navigate_to_motivation',
                  type: 'custom',
                  conditions: [],
                  action: [
                    {
                      type: 'navigation',
                      deeplink: 'motivation',
                    },
                  ],
                },
              ],
            },
            {
              type: 'spacer',
              state: {
                id: 'bottom_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
          ],
        },
      ],
      events: [
        {
          id: 'navigate_to_motivation',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'motivation',
            },
          ],
        },
      ],
    },

    // Screen 5: motivation
    {
      id: 'motivation',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'openQuestion',
              state: {
                id: 'motivation_question',
                question: "And what's motivating you to make that change?",
              },
              style: {},
              events: [
                {
                  id: 'navigate_to_intention',
                  type: 'custom',
                  conditions: [],
                  action: [
                    {
                      type: 'navigation',
                      deeplink: 'intention',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      events: [
        {
          id: 'navigate_to_intention',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'intention',
            },
          ],
        },
      ],
    },

    // Screen 6: intention
    {
      id: 'intention',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'openQuestion',
              state: {
                id: 'intention_question',
                question: 'What would you like to put a little focus on this week?',
              },
              style: {},
              events: [
                {
                  id: 'navigate_to_rewards',
                  type: 'custom',
                  conditions: [],
                  action: [
                    {
                      type: 'navigation',
                      deeplink: 'rewards',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      events: [
        {
          id: 'navigate_to_rewards',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'rewards',
            },
          ],
        },
      ],
    },

    // Screen 7: rewards
    {
      id: 'rewards',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'top_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
            {
              type: 'animatedImage',
              state: {
                id: 'rewards_animation',
                lottieName: 'COLOR_Pelago_Rewards',
              },
              style: {
                width: 280,
                height: 280,
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'rewards_title',
                text: 'Earn rewards as you go',
              },
              style: {
                style: 'heading1',
                alignment: 'center',
                color: 'primary',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'mid_spacer',
              },
              style: {
                height: 16,
                width: null,
                isFlexible: false,
                direction: 'vertical',
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'rewards_description',
                text: 'Every check-in earns you points that you can redeem for rewards. The more consistent you are, the more you earn!',
              },
              style: {
                style: 'body1',
                alignment: 'center',
                color: 'secondary',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'bottom_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
          ],
        },
      ],
      events: [
        {
          id: 'navigate_to_checkin_commitment',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'checkin-commitment',
            },
          ],
        },
      ],
    },

    // Screen 8: checkin-commitment (was Screen 7)
    {
      id: 'checkin-commitment',
      title: '',
      hidesBackButton: true,
      state: {
        selectedCommitment: null,
      },
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'top_spacer',
              },
              style: {
                height: 32,
                width: null,
                isFlexible: false,
                direction: 'vertical',
              },
            },
            {
              type: 'largeQuestion',
              state: {
                id: 'checkin_commitment_question',
                copyId: null,
                category: 'check-in',
                caption: null,
                header: {
                  id: 'checkin_header',
                  title: 'How often would you like to check in this week?',
                  caption: null,
                  description: null,
                  imageName: null,
                },
                options: [
                  {
                    id: 'daily',
                    title: 'Every day',
                    description: 'Check in daily to build a strong habit',
                  },
                  {
                    id: 'few_times',
                    title: 'A few times',
                    description: 'Check in 3-4 times this week',
                  },
                  {
                    id: 'once',
                    title: 'Once',
                    description: 'Check in once this week',
                  },
                ],
                type: 'singleSelect',
                maxSelection: 1,
                allowsMultiSelection: false,
                currentlySelectedOptions: null,
              },
            },
          ],
        },
      ],
      events: [
        {
          id: 'select_daily_commitment',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'stateUpdate',
              scope: 'screen',
              updates: {
                selectedCommitment: ['daily'],
              },
            },
            {
              type: 'stateUpdate',
              scope: 'module',
              updates: {
                checkinCommitment: 'Every day',
              },
            },
            {
              type: 'navigation',
              deeplink: 'pq-notification-setup',
            },
          ],
        },
        {
          id: 'select_few_times_commitment',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'stateUpdate',
              scope: 'screen',
              updates: {
                selectedCommitment: ['few_times'],
              },
            },
            {
              type: 'stateUpdate',
              scope: 'module',
              updates: {
                checkinCommitment: 'A few times',
              },
            },
            {
              type: 'navigation',
              deeplink: 'pq-notification-setup',
            },
          ],
        },
        {
          id: 'select_once_commitment',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'stateUpdate',
              scope: 'screen',
              updates: {
                selectedCommitment: ['once'],
              },
            },
            {
              type: 'stateUpdate',
              scope: 'module',
              updates: {
                checkinCommitment: 'Once',
              },
            },
            {
              type: 'navigation',
              deeplink: 'pq-notification-setup',
            },
          ],
        },
        {
          id: 'navigate_to_notification_setup',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'pq-notification-setup',
            },
          ],
        },
      ],
    },

    // Screen 8: pq-notification-setup
    {
      id: 'pq-notification-setup',
      title: '',
      hidesBackButton: true,
      state: {
        notificationsEnabled: true,
      },
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'top_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
            {
              type: 'animatedImage',
              state: {
                id: 'notification_animation',
                lottieName: 'COLOR_Pelago_WalkWithPhone',
              },
              style: {
                width: 280,
                height: 280,
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'permissions_header',
                text: 'Stay on track with notifications',
              },
              style: {
                style: 'heading1',
                alignment: 'center',
                color: 'primary',
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'permissions_description',
                text: 'Get notified when there\'s a new chat waiting or when your call is coming up \n(e.g., "Your call is in one hour").',
              },
              style: {
                style: 'body1',
                alignment: 'center',
                color: 'secondary',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'bottom_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
            {
              type: 'toggleCard',
              state: {
                id: 'notifications-toggle',
                title: 'Turn on notifications',
                description: null,
                label: 'Recommended',
                isToggled: true,
              },
              style: {
                icon: 'Notification',
                backgroundColor: 'secondaryDisabled',
                borderColor: 'secondaryDefault',
                cornerRadius: 8,
              },
              events: [
                {
                  id: 'NotificationToggled',
                  type: 'onToggle',
                  conditions: [],
                  action: [],
                },
              ],
            },
          ],
        },
      ],
      events: [
        {
          id: 'permissions_screen_event',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'stateUpdate',
              scope: 'screen',
              updates: {
                notificationsEnabled: true,
              },
            },
          ],
        },
        {
          id: 'navigate_to_plan_review',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'pq-plan-review',
            },
          ],
        },
      ],
    },

    // Screen 9: pq-plan-review
    {
      id: 'pq-plan-review',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'title_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'top_spacer',
              },
              style: {
                height: 24,
                width: null,
                isFlexible: false,
                direction: 'vertical',
              },
            },
            {
              type: 'textBlock',
              state: {
                id: 'review_title',
                text: 'Your plan for this week',
              },
              style: {
                style: 'heading1',
                alignment: 'center',
                color: 'primary',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'title_widgets_spacer',
              },
              style: {
                height: 24,
                width: null,
                isFlexible: false,
                direction: 'vertical',
              },
            },
          ],
        },
        {
          id: 'summary_cards_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'textCard',
              state: {
                id: 'about_you_card',
                title: 'About you',
                content: '{$moduleData.aboutYouSummary}',
              },
              style: {
                backgroundColor: 'backgroundLightMintGreen',
                borderColor: 'backgroundLightMintGreen',
                captionColor: 'textGlobalSecondary',
                textColor: 'textGlobalPrimary',
                borderWidth: 1,
                cornerRadius: 16,
              },
              conditions: [
                {
                  rules: {
                    and: [
                      { '!=': [{ var: 'summary' }, null] },
                      { '!=': [{ var: 'summary' }, '' ] },
                    ],
                  },
                  state: {
                    summary: '{$moduleData.aboutYouSummary}',
                  },
                },
              ],
            },
            {
              type: 'textCard',
              state: {
                id: 'your_why_card',
                title: 'your why',
                content: '{$moduleData.yourWhySummary}',
              },
              style: {
                backgroundColor: 'backgroundLightMintGreen',
                borderColor: 'backgroundLightMintGreen',
                captionColor: 'textGlobalSecondary',
                textColor: 'textGlobalPrimary',
                borderWidth: 1,
                cornerRadius: 16,
              },
              conditions: [
                {
                  rules: {
                    and: [
                      { '!=': [{ var: 'summary' }, null] },
                      { '!=': [{ var: 'summary' }, '' ] },
                    ],
                  },
                  state: {
                    summary: '{$moduleData.yourWhySummary}',
                  },
                },
              ],
            },
            {
              type: 'textCard',
              state: {
                id: 'outcomes_card',
                title: 'Outcomes',
                content: '{$moduleData.outcomesSummary}',
              },
              style: {
                backgroundColor: 'backgroundLightMintGreen',
                borderColor: 'backgroundLightMintGreen',
                captionColor: 'textGlobalSecondary',
                textColor: 'textGlobalPrimary',
                borderWidth: 1,
                cornerRadius: 16,
              },
              conditions: [
                {
                  rules: {
                    and: [
                      { '!=': [{ var: 'summary' }, null] },
                      { '!=': [{ var: 'summary' }, '' ] },
                    ],
                  },
                  state: {
                    summary: '{$moduleData.outcomesSummary}',
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'widgets_spacer_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'widgets_top_spacer',
              },
              style: {
                height: 24,
                width: null,
                isFlexible: false,
                direction: 'vertical',
              },
            },
          ],
        },
        {
          id: 'widgets_section',
          title: '',
          position: 'body',
          layout: 'grid',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'miniWidget',
              state: {
                id: 'drinking_streak_widget',
                title: '{$moduleData.checkInStreak}',
                content: 'Day streak',
              },
              style: {
                backgroundColor: 'backgroundCerulean',
                cornerRadius: 8,
              },
            },
            {
              type: 'miniWidget',
              state: {
                id: 'intention_widget',
                title: '{$moduleData.weeklyIntention}',
                content: 'Your focus',
              },
              style: {
                backgroundColor: 'backgroundLightMintGreen',
                cornerRadius: 8,
              },
            },
            {
              type: 'miniWidget',
              state: {
                id: 'checkin_commitment_widget',
                title: '{$moduleData.checkinCommitment}',
                content: 'Check-ins this week',
              },
              style: {
                backgroundColor: 'backgroundMistBlue',
                cornerRadius: 8,
              },
            },
            {
              type: 'miniWidget',
              state: {
                id: 'cbt_session_widget',
                title: 'Coming soon',
                content: 'CBT session',
              },
              style: {
                backgroundColor: 'backgroundLight',
                borderColor: 'secondaryDefault',
                borderDashed: true,
                cornerRadius: 8,
              },
            },
          ],
        }
      ],
      events: [
        {
          id: 'navigate_to_completion',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'navigation',
              deeplink: 'pq-start-programme',
            },
          ],
        },
      ],
    },

    // Screen 10: pq-start-programme
    {
      id: 'pq-start-programme',
      title: '',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: '',
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: {
                id: 'top_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
            {
              type: 'animatedImage',
              state: {
                id: 'completion_animation',
                lottieName: 'COLOR_Pelago_Island',
              },
              style: {
                width: 300,
                height: 300,
              },
            },
            {
              type: 'animatedComponents',
              state: {
                id: 'completion_animation_text',
                elements: [
                  {
                    type: 'textBlock',
                    state: {
                      id: 'completion_text1',
                      text: 'Loading your program',
                    },
                    style: {
                      style: 'heading1',
                      alignment: 'center',
                      color: 'primary',
                    },
                  },
                  {
                    type: 'textBlock',
                    state: {
                      id: 'completion_text2',
                      text: 'All set! Let\'s start your program',
                    },
                    style: {
                      style: 'heading1',
                      alignment: 'center',
                      color: 'primary',
                    },
                  },
                ],
              },
              style: {
                duration: 2.0,
                loop: false,
                autoStart: true,
                direction: 'forward',
                curve: 'easeInOut',
                pauseOnTap: false,
              },
              events: [
                {
                  id: 'completion_animation_complete',
                  type: 'onAnimationComplete',
                  conditions: [],
                  action: [
                    {
                      type: 'serviceCall',
                      serviceName: 'pqService',
                      functionName: 'submitAnswers_DISABLED',
                      parameters: {
                        postWebPQAnswers: '{$moduleData.postWebPQAnswers}',
                        configurationId: '{$moduleData.postWebPQConfigurationId}',
                      },
                      onSuccess: [
                        {
                          type: 'closeModule',
                          flowCompleted: true,
                          parameters: {
                            reason: 'post_web_pq_completed_successfully',
                          },
                        },
                      ],
                      onError: [
                        {
                          type: 'closeModule',
                          flowCompleted: true,
                          parameters: {
                            reason: 'post_web_pq_disabled_for_testing',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'loadingView',
              state: {
                id: 'completion_loading_indicator',
              },
            },
            {
              type: 'spacer',
              state: {
                id: 'bottom_spacer',
              },
              style: {
                height: null,
                width: null,
                isFlexible: true,
                direction: 'vertical',
              },
            },
          ],
        },
      ],
      events: [
        {
          id: 'complete_intake_flow',
          type: 'custom',
          conditions: [],
          action: [
            {
              type: 'closeModule',
              flowCompleted: true,
              parameters: {
                reason: 'intake_flow_completed',
              },
            },
          ],
        },
      ],
    },
  ];
}

