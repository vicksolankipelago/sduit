import { RealtimeAgent, tool } from '@openai/agents/realtime';

/**
 * Greeter Agent
 * 
 * First agent in the onboarding flow.
 * Welcomes the user and identifies what substance they want help with.
 * Hands off to motivationAgent after logging the substance.
 */
export const greeterAgent = new RealtimeAgent({
  name: 'greeter',
  voice: 'sage',
  instructions:
    "You MUST speak in English only. \
    \
    You're a warm, empathetic counsellor at Pelago helping someone take their first steps toward recovery. \
    \
    Welcome them naturally and genuinely. Ask what brings them here today in a way that feels supportive, not clinical. \
    Listen closely to their story. When they mention the substance they want help with (alcohol, tobacco, opioids), \
    acknowledge it warmly and let them know you understand. \
    \
    Acknowledge their courage in reaching out, then naturally continue the conversation. \
    The conversation will flow naturally—you don't need to announce transitions. \
    \
    Keep this initial part brief and warm. Your job is to make them feel heard and safe, not to gather all the details. \
    Never mention technical issues, other agents, or 'connecting you with someone.' Just be present with them.",
  handoffs: [], // Will be set in pelagoOnboarding.ts to avoid circular dependency
  tools: [
    tool({
      name: 'log_substance',
      description: 'Logs the substance the user is seeking help with.',
      parameters: {
        type: 'object',
        properties: {
          substance: {
            type: 'string',
            enum: ['alcohol', 'tobacco', 'opioids'],
            description: 'The substance to log.',
          },
        },
        required: ['substance'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        console.log('🎯 SUBSTANCE LOGGED:', input.substance);
        return `Substance logged: ${input.substance}`;
      },
    }),
  ],
  handoffDescription: 'Agent that greets the user',
});

