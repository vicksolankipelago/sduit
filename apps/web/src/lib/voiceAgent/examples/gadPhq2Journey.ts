/**
 * GAD-2 / PHQ-2 Mental Health Screening Journey
 * 
 * Voice-guided mental health screening assessment
 * Based on iOS mobile app configuration (gad-phq-2.json)
 */

import { Journey, Agent, Screen } from '../../../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { loadPromptTemplate } from '../../../utils/promptTemplates';

/**
 * Create the GAD-2 / PHQ-2 Journey with gad_phq2_prompt.txt content
 */
export async function createGadPhq2Journey(): Promise<Journey> {
  // Load the GAD-PHQ2 prompt from the template file
  let agentPrompt: string;
  try {
    agentPrompt = await loadPromptTemplate('gad_phq2_prompt');
    console.log('✅ Loaded gad_phq2_prompt.txt for GAD-2 / PHQ-2 journey');
  } catch (error) {
    console.warn('⚠️ Failed to load gad_phq2_prompt.txt, using fallback prompt', error);
    // Fallback to basic prompt if template loading fails
    agentPrompt = `You are a compassionate mental health screening assistant.

Complete a 4-question assessment (GAD-2 and PHQ-2) with the member.

## Voice and Tone
- Warm, calm, non-judgmental, conversational
- Speak at a moderate pace - not too fast
- Keep responses brief and focused
- Create a safe space for honest answers

## Tool Call Rules
- You MUST issue function calls to navigate between screens
- Call trigger_event after EACH answer to advance to the next screen
- Always wait for the member to respond before moving forward`;
  }

  const agentId = uuidv4();
  
  const agent: Agent = {
    id: agentId,
    name: 'Mental Health Screening Agent',
    voice: 'shimmer',
    prompt: agentPrompt, // Use the loaded prompt template
    tools: [
      {
        id: 'trigger_event',
        name: 'trigger_event',
        description: 'Trigger a screen event to navigate between screens. Use this to control the flow through the screening questions.',
        parameters: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'The ID of the event to trigger (e.g., "start_gad2_questions", "to_gad2_q2")',
            },
          },
          required: ['eventId'],
        },
      },
    ],
    handoffs: [],
    handoffDescription: 'Mental health screening agent that guides members through GAD-2 / PHQ-2 assessment',
    position: { x: 100, y: 100 },
    screens: createGadPhq2Screens(),
    screenPrompts: {}, // All prompts are in the main agent prompt
  };

  const journey: Journey = {
    id: uuidv4(),
    name: 'Mental Health Screening',
    description: 'Brief 4-question mental health screening assessment covering anxiety (GAD-2) and depression (PHQ-2). Voice-guided with validation and scoring.',
    voice: 'shimmer', // Consistent voice across all agents
    systemPrompt: `## Language Requirement
**CRITICAL: You must ALWAYS respond in English. Never use any other language.**

## General Guidelines

### Voice and Tone
- Warm, calm, non-judgmental, conversational
- Speak at a moderate pace - not too fast
- Keep responses brief and focused
- Create a safe space for honest answers
- Use {{memberName}} appropriately

### Response Guidelines
- Always wait for the member to respond before moving forward
- Validate each response before navigating
- Never rush through questions
- The flow is: SPEAK → WAIT → LISTEN → VALIDATE → RESPOND → NAVIGATE

### Tool Call Rules
- You MUST call trigger_event() to navigate between screens
- Call trigger_event ONLY AFTER hearing the member's response
- Never skip trigger_event calls - UI cannot advance without them`,
    agents: [agent],
    startingAgentId: agentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  return journey;
}

function createGadPhq2Screens(): Screen[] {
  return [
    // Screen 1: Introduction
    {
      id: 'introduction',
      title: 'Mental Health Screening',
      hidesBackButton: false,
      state: {
        voiceNavigationEnabled: true, // Voice agent controls navigation
      },
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: { id: 'top_spacer_intro' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
            {
              type: 'animatedImage',
              state: { id: 'intro_animation', lottieName: 'COLOR_Pelago_Boat' },
              style: { width: 300, height: 300 },
            },
            {
              type: 'textBlock',
              state: { id: 'intro_title', text: 'How are you feeling today?' },
              style: { style: 'heading1', alignment: 'center', color: 'primary' },
            },
            {
              type: 'textBlock',
              state: { id: 'intro_subtitle', text: 'In the last two weeks, how often have you been bothered by the following:' },
              style: { style: 'body1', alignment: 'center', color: 'secondary' },
            },
            {
              type: 'spacer',
              state: { id: 'bottom_spacer_intro' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
          ],
        },
        {
          id: 'cta_section',
          title: null as any,
          position: 'fixed-bottom',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'button',
              state: { id: 'intro_continue_cta', title: 'Continue', isDisabled: false },
              style: { style: 'primary', size: 'large' },
              conditions: [
                {
                  rules: { '==': [{ var: 'voiceNavigationEnabled' }, false] },
                  state: { voiceNavigationEnabled: true },
                },
              ],
              events: [
                {
                  id: 'start_gad2_questions',
                  type: 'onSelected',
                  conditions: [],
                  action: [{ type: 'navigation', deeplink: 'gad2-q1' }],
                },
              ],
            },
          ],
        },
      ],
    },

    // Screen 2: GAD-2 Question 1
    {
      id: 'gad2-q1',
      title: 'Question 1 of 4',
      hidesBackButton: false,
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'largeQuestion',
              state: {
                id: 'gad2_q1_state',
                title: 'Feeling nervous, anxious or on edge?',
                options: [
                  { id: 'no_days', title: 'No days', description: "Haven't experienced this at all" },
                  { id: 'several_days', title: 'Several days', description: 'A few days during the two weeks' },
                  { id: 'seven_or_more_days', title: 'Seven or more days', description: 'At least half the time' },
                  { id: 'nearly_every_day', title: 'Nearly every day', description: 'Most or all days' },
                ],
                selectedOptionId: null,
              },
            },
          ],
        },
        {
          id: 'cta_section',
          title: null as any,
          position: 'fixed-bottom',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'button',
              state: { id: 'gad2_q1_continue', title: 'Continue', isDisabled: false },
              style: { style: 'primary', size: 'large' },
              conditions: [
                {
                  rules: { '==': [{ var: 'voiceNavigationEnabled' }, false] },
                  state: { voiceNavigationEnabled: true },
                },
              ],
              events: [
                {
                  id: 'to_gad2_q2',
                  type: 'onSelected',
                  conditions: [],
                  action: [{ type: 'navigation', deeplink: 'gad2-q2' }],
                },
              ],
            },
          ],
        },
      ],
    },

    // Screen 3: GAD-2 Question 2
    {
      id: 'gad2-q2',
      title: 'Question 2 of 4',
      hidesBackButton: false,
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'largeQuestion',
              state: {
                id: 'gad2_q2_state',
                title: 'Not being able to stop or control worrying?',
                options: [
                  { id: 'no_days', title: 'No days', description: "Haven't experienced this at all" },
                  { id: 'several_days', title: 'Several days', description: 'A few days during the two weeks' },
                  { id: 'seven_or_more_days', title: 'Seven or more days', description: 'At least half the time' },
                  { id: 'nearly_every_day', title: 'Nearly every day', description: 'Most or all days' },
                ],
                selectedOptionId: null,
              },
            },
          ],
        },
        {
          id: 'cta_section',
          title: null as any,
          position: 'fixed-bottom',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'button',
              state: { id: 'gad2_q2_continue', title: 'Continue', isDisabled: false },
              style: { style: 'primary', size: 'large' },
              conditions: [
                {
                  rules: { '==': [{ var: 'voiceNavigationEnabled' }, false] },
                  state: { voiceNavigationEnabled: true },
                },
              ],
              events: [
                {
                  id: 'to_phq2_q1',
                  type: 'onSelected',
                  conditions: [],
                  action: [{ type: 'navigation', deeplink: 'phq2-q1' }],
                },
              ],
            },
          ],
        },
      ],
    },

    // Screen 4: PHQ-2 Question 1
    {
      id: 'phq2-q1',
      title: 'Question 3 of 4',
      hidesBackButton: false,
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'largeQuestion',
              state: {
                id: 'phq2_q1_state',
                title: 'Little interest or pleasure in doing things.',
                options: [
                  { id: 'no_days', title: 'No days', description: "Haven't experienced this at all" },
                  { id: 'several_days', title: 'Several days', description: 'A few days during the two weeks' },
                  { id: 'seven_or_more_days', title: 'Seven or more days', description: 'At least half the time' },
                  { id: 'nearly_every_day', title: 'Nearly every day', description: 'Most or all days' },
                ],
                selectedOptionId: null,
              },
            },
          ],
        },
        {
          id: 'cta_section',
          title: null as any,
          position: 'fixed-bottom',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'button',
              state: { id: 'phq2_q1_continue', title: 'Continue', isDisabled: false },
              style: { style: 'primary', size: 'large' },
              conditions: [
                {
                  rules: { '==': [{ var: 'voiceNavigationEnabled' }, false] },
                  state: { voiceNavigationEnabled: true },
                },
              ],
              events: [
                {
                  id: 'to_phq2_q2',
                  type: 'onSelected',
                  conditions: [],
                  action: [{ type: 'navigation', deeplink: 'phq2-q2' }],
                },
              ],
            },
          ],
        },
      ],
    },

    // Screen 5: PHQ-2 Question 2
    {
      id: 'phq2-q2',
      title: 'Question 4 of 4',
      hidesBackButton: false,
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'largeQuestion',
              state: {
                id: 'phq2_q2_state',
                title: 'Feeling down, depressed, or hopeless.',
                options: [
                  { id: 'no_days', title: 'No days', description: "Haven't experienced this at all" },
                  { id: 'several_days', title: 'Several days', description: 'A few days during the two weeks' },
                  { id: 'seven_or_more_days', title: 'Seven or more days', description: 'At least half the time' },
                  { id: 'nearly_every_day', title: 'Nearly every day', description: 'Most or all days' },
                ],
                selectedOptionId: null,
              },
            },
          ],
        },
        {
          id: 'cta_section',
          title: null as any,
          position: 'fixed-bottom',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'button',
              state: { id: 'phq2_q2_continue', title: 'Continue', isDisabled: false },
              style: { style: 'primary', size: 'large' },
              conditions: [
                {
                  rules: { '==': [{ var: 'voiceNavigationEnabled' }, false] },
                  state: { voiceNavigationEnabled: true },
                },
              ],
              events: [
                {
                  id: 'to_thank_you',
                  type: 'onSelected',
                  conditions: [],
                  action: [{ type: 'navigation', deeplink: 'thank-you' }],
                },
              ],
            },
          ],
        },
      ],
    },

    // Screen 6: Thank You
    {
      id: 'thank-you',
      title: 'Complete',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: true,
          elements: [
            {
              type: 'spacer',
              state: { id: 'top_spacer_thanks' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
            {
              type: 'animatedImage',
              state: { id: 'thanks_animation', lottieName: 'COLOR_Pelago_Boat' },
              style: { width: 300, height: 300 },
            },
            {
              type: 'textBlock',
              state: { id: 'thanks_title', text: 'Thank you for completing the assessment' },
              style: { style: 'heading1', alignment: 'center', color: 'primary' },
            },
            {
              type: 'textBlock',
              state: { 
                id: 'thanks_subtitle', 
                text: 'Your responses help us provide you with the best possible support for your mental wellbeing journey.' 
              },
              style: { style: 'body1', alignment: 'center', color: 'secondary' },
            },
            {
              type: 'spacer',
              state: { id: 'bottom_spacer_thanks' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
          ],
        },
        {
          id: 'cta_section',
          title: null as any,
          position: 'fixed-bottom',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'button',
              state: { id: 'complete_cta', title: 'Finish', isDisabled: false },
              style: { style: 'primary', size: 'large' },
              events: [
                {
                  id: 'complete_screening',
                  type: 'onSelected',
                  conditions: [],
                  action: [
                    { type: 'closeModule', flowCompleted: true, parameters: { completionReason: 'gad_phq2_finished' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

