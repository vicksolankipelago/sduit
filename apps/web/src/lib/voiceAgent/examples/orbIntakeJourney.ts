/**
 * Orb Intake Journey
 * 
 * Voice-guided intake call featuring the interactive 3D orb visualization
 * A single SDUI screen with the orb as the central element
 */

import { Journey, Agent, Screen } from '../../../types/journey';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create the Orb Intake Journey with a single orb screen
 */
export async function createOrbIntakeJourney(): Promise<Journey> {
  const agentId = uuidv4();
  
  const agent: Agent = {
    id: agentId,
    name: 'Intake Agent',
    voice: 'shimmer',
    prompt: `You are Navi, a warm and supportive voice agent for Pelago.

Guide members through their intake call with compassion and clarity.

## Voice and Tone
- Warm, supportive, and calm
- Conversational and friendly
- Encouraging and non-judgmental

## Response Guidelines
- Keep responses concise and focused
- Reflect their language back to them
- Validate their goals and motivations
- Be encouraging without being pushy
- Allow natural pauses for their responses`,
    tools: [],
    handoffs: [],
    handoffDescription: 'Intake agent that guides members through onboarding',
    position: { x: 100, y: 100 },
    screens: createOrbScreens(),
    screenPrompts: {},
  };

  const journey: Journey = {
    id: uuidv4(),
    name: 'Orb Intake Flow',
    description: 'A streamlined intake experience featuring the interactive voice orb visualization.',
    voice: 'shimmer',
    systemPrompt: `## General Guidelines

### Language
- **ALWAYS respond in English**
- All communication must be in English

### Voice and Tone
- Warm, supportive, and calm
- Conversational and friendly
- Encouraging and non-judgmental

### Response Guidelines
- Keep responses concise and focused
- Validate their goals and motivations
- Be encouraging without being pushy
- Allow natural pauses for their responses`,
    agents: [agent],
    startingAgentId: agentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  };

  return journey;
}

function createOrbScreens(): Screen[] {
  return [
    {
      id: 'orb-intake',
      title: 'Welcome',
      hidesBackButton: true,
      sections: [
        {
          id: 'content_section',
          title: null as any,
          position: 'body',
          layout: 'stack',
          direction: 'vertical',
          scrollable: false,
          elements: [
            {
              type: 'spacer',
              state: { id: 'top_spacer' },
              style: { height: null, width: null, isFlexible: true, direction: 'vertical' },
            },
            {
              type: 'textBlock',
              state: { id: 'welcome_title', text: 'Hi, I\'m Navi' },
              style: { style: 'heading1', alignment: 'center', color: 'primary' },
            },
            {
              type: 'textBlock',
              state: { id: 'welcome_subtitle', text: 'Your personal guide' },
              style: { style: 'body1', alignment: 'center', color: 'secondary' },
            },
            {
              type: 'spacer',
              state: { id: 'orb_top_spacer' },
              style: { height: 32, width: null, isFlexible: false, direction: 'vertical' },
            },
            {
              type: 'orb',
              state: {
                id: 'voice_orb',
                colors: ['#A2CC6E', '#DDF1C4'],
                agentState: 'listening',
                volumeMode: 'auto',
              },
              style: { size: 'medium' },
            },
            {
              type: 'spacer',
              state: { id: 'orb_bottom_spacer' },
              style: { height: 32, width: null, isFlexible: false, direction: 'vertical' },
            },
            {
              type: 'textBlock',
              state: { id: 'instruction', text: 'Tap to start talking' },
              style: { style: 'caption', alignment: 'center', color: 'tertiary' },
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
  ];
}
