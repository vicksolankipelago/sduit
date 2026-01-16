import { RealtimeAgent, tool } from '@openai/agents/realtime';

/**
 * Motivation Agent
 * 
 * Second agent in the onboarding flow.
 * Explores user's motivations and goals for seeking help.
 * Hands off to baselineCalculationAgent after logging motivations/goals.
 */
export const motivationAgent = new RealtimeAgent({
  name: 'motivationAgent',
  voice: 'sage',
  instructions:
    "You're continuing a supportive conversation. They've already shared what they want help with. \
    \
    Now, explore what matters to them. Ask about what's driving this decision—what made them decide now is the time? \
    Maybe it's about their family, their health, their sense of self, work, or something deeply personal. \
    \
    Listen for their real motivations and goals. As they share, reflect back what you hear to show you understand. \
    \
    Once you've understood a few key motivations or goals, acknowledge how meaningful these are. \
    The conversation will naturally continue to understanding their current patterns. \
    \
    Be genuinely curious, not interrogating. Reflect back what you hear. Make them feel understood. \
    Never mention 'next steps,' 'other agents,' or technical processes. Just stay in the conversation.",
  handoffs: [], // Will be set in pelagoOnboarding.ts to avoid circular dependency
  tools: [
    tool({
      name: 'log_motivation_or_goal',
      description: 'Logs the user\'s motivations and goals for their recovery journey.',
      parameters: {
        type: 'object',
        properties: {
          entryType: {
            type: 'string',
            enum: ['motivation', 'goal'],
            description: 'Whether this is a motivation (what drives them) or a goal (what they want to achieve).',
          },
          content: {
            type: 'string',
            description: 'The specific motivation or goal the user mentioned.',
          },
          category: {
            type: 'string',
            enum: ['health', 'family', 'career', 'financial', 'personal', 'social', 'other'],
            description: 'The category this motivation or goal falls under.',
          },
        },
        required: ['entryType', 'content'],
        additionalProperties: false,
      },
      execute: async (input: any, context: any) => {
        const { entryType, content, category = 'other' } = input;
        
        const logEntry = {
          entryType,
          content,
          category,
          timestamp: new Date().toISOString(),
        };
        
        const logMessage = `${entryType.toUpperCase()} LOGGED: "${content}" (Category: ${category})`;
        
        if (context) {
          if (context.addTranscriptBreadcrumb) {
            context.addTranscriptBreadcrumb(logMessage, logEntry);
          }
          if (context.sendEvent) {
            context.sendEvent({ 
              type: `${entryType}_logged`, 
              ...logEntry
            });
          }
        }
        
        console.log(`💪 ${entryType.toUpperCase()} LOGGED:`, content);
        
        return `${entryType} logged: ${content}`;
      },
    }),
  ],
  handoffDescription: 'Agent that finds the users motivation and goals',
});

