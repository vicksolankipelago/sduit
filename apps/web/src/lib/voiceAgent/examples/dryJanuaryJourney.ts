/**
 * Dry January Intake Call Journey
 * 
 * Voice-guided intake call for members joining the Dry January program
 * Sets up goals, motivations, support preferences, and check-in habits
 */

import { Journey, Agent, Screen } from '../../../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { loadPromptTemplate } from '../../../utils/promptTemplates';

/**
 * Create the Dry January Journey with dry_january_prompt.txt content
 */
export async function createDryJanuaryJourney(): Promise<Journey> {
  // Load the Dry January prompt from the template file
  let agentPrompt: string;
  try {
    agentPrompt = await loadPromptTemplate('dry_january_prompt');
    console.log('✅ Loaded dry_january_prompt.txt for Dry January journey');
  } catch (error) {
    console.warn('⚠️ Failed to load dry_january_prompt.txt, using fallback prompt', error);
    // Fallback to basic prompt if template loading fails
    agentPrompt = `You are Navi, a warm and supportive voice agent for Pelago's Dry January program.

Guide members through a quick intake call to set up their Dry January journey.

## Voice and Tone
- Warm, supportive, enthusiastic but not overly energetic
- Conversational and friendly
- Encouraging and non-judgmental

## Response Guidelines
- Keep responses concise and focused
- Reflect their language back to them
- Validate their goals and motivations
- Be encouraging without being pushy`;
  }

  const agentId = uuidv4();
  
  const agent: Agent = {
    id: agentId,
    name: 'Dry January Intake Agent',
    voice: 'shimmer',
    prompt: agentPrompt,
    tools: [],
    handoffs: [],
    handoffDescription: 'Dry January intake agent that sets up member goals and support preferences',
    position: { x: 100, y: 100 },
    screens: createDryJanuaryScreens(),
    screenPrompts: {},
  };

  const journey: Journey = {
    id: uuidv4(),
    name: 'Dry January Intake Call',
    description: 'Quick intake call to set up Dry January goals, explore motivations, configure support preferences, and establish check-in habits for a successful alcohol-free month.',
    voice: 'shimmer',
    systemPrompt: `## General Guidelines

### Language
- **ALWAYS respond in English**
- Never use any other language
- All communication must be in English

### Voice and Tone
- Warm, supportive, enthusiastic but not overly energetic
- Conversational and friendly
- Encouraging and non-judgmental
- Use {{memberName}} 2-3 times throughout the call
- Speak clearly at a moderate pace

### Response Guidelines
- Keep responses concise and focused
- Reflect their language back to them
- Validate their goals and motivations
- Be encouraging without being pushy
- Allow natural pauses for their responses

### Timing
- Total call duration: ~5 minutes
- Don't rush through questions
- Give them space to think and respond fully`,
    agents: [agent],
    startingAgentId: agentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  return journey;
}

function createDryJanuaryScreens(): Screen[] {
  return [
    // Screen 1: Welcome
    {
      id: 'dj-welcome',
      title: 'Dry January',
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
              state: { id: 'top_spacer' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
            {
              type: 'animatedImage',
              state: { id: 'welcome_animation', lottieName: 'COLOR_Pelago_Boat' },
              style: { width: 250, height: 250 },
            },
            {
              type: 'textBlock',
              state: { id: 'welcome_title', text: 'Welcome to Dry January!' },
              style: { style: 'heading1', alignment: 'center', color: 'primary' },
            },
            {
              type: 'textBlock',
              state: { id: 'welcome_subtitle', text: "Let's set you up for a successful alcohol-free month." },
              style: { style: 'body1', alignment: 'center', color: 'secondary' },
            },
            {
              type: 'spacer',
              state: { id: 'bottom_spacer' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
          ],
        },
      ],
    },

    // Screen 2: Goal Summary
    {
      id: 'dj-summary',
      title: 'Your Dry January Plan',
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
              type: 'textBlock',
              state: { id: 'summary_header', text: "You're all set!" },
              style: { style: 'heading1', alignment: 'center', color: 'primary' },
            },
            {
              type: 'checklistCard',
              state: {
                id: 'plan_checklist',
                title: 'Your Plan',
                itemTitles: [
                  '✓ Goal defined',
                  '✓ Motivation identified',
                  '✓ Support configured',
                  '✓ Check-ins scheduled',
                ],
              },
              style: {
                backgroundColor: '#F7DFFE',
                cornerRadius: 12,
              },
            },
            {
              type: 'textBlock',
              state: { 
                id: 'encouragement', 
                text: "You've got this! Your first check-in will be available tomorrow. Remember, you're not alone - thousands are doing Dry January with Pelago." 
              },
              style: { style: 'body1', alignment: 'center', color: 'secondary' },
            },
          ],
        },
      ],
    },
  ];
}

