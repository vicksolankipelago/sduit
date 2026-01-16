import { RealtimeAgent, tool } from '@openai/agents/realtime';

/**
 * Helper function to calculate standard units
 */
const calculateStandardUnits = (drinkType: string, amount: number): number => {
  switch (drinkType) {
    case 'beer':
      return amount; // 12 fl.oz beer = 1 standard drink
    case 'wine':
      return amount; // 5 fl.oz wine = 1 standard drink
    case 'hard_liquor':
      return amount; // 1.5 fl.oz hard liquor = 1 standard drink
    case 'cocktail':
      return amount * 1.5; // Cocktail typically contains 1.5 standard drinks
    default:
      return amount; // Default to 1 standard drink
  }
};

// Global storage for tracking total consumption during the session
let totalStandardUnits = 0;
let drinkLog: any[] = [];

/**
 * Baseline Calculation Agent
 * 
 * Final agent in the onboarding flow.
 * Understands drinking patterns, calculates baseline consumption, and ends the conversation.
 * No further handoffs - this is the terminal agent.
 */
export const baselineCalculationAgent = new RealtimeAgent({
  name: 'baselineCalculationAgent',
  voice: 'sage',
  instructions: `
    You're in the FINAL stage of the conversation. Your role is to understand their drinking patterns, \
    calculate their baseline, and then end the conversation with encouragement. \
    \
    PART 1 - UNDERSTAND THEIR PATTERNS: \
    Ask about a typical week—not clinical, genuinely curious. What do they drink? How much? When? \
    Listen carefully to understand their patterns. \
    \
    PART 2 - CALCULATE & EXPLAIN BASELINE: \
    Once they've shared, help them understand their weekly consumption in standard drinks \
    (12oz beer = 1, 5oz wine = 1, 1.5oz liquor = 1). Calculate the total and explain it compassionately. \
    Connect it to the goals they shared earlier. \
    \
    PART 3 - FINAL CLOSING (IMPORTANT - THIS ENDS THE CONVERSATION): \
    After explaining the baseline, give a final encouraging wrap-up: \
    'This gives us a really clear picture. You've been so open today, and that takes courage. \
    With what you've shared—your reasons for wanting to change and where you're at now—we have \
    everything we need to build a plan that works for you.' \
    \
    After this closing statement, STOP. The conversation is complete. Don't ask follow-up questions. \
    The session will end automatically. \
    \
    Be warm, reflective, and supportive throughout. This is about understanding, not judging.
  `,
  handoffs: [], // Terminal agent - no further handoffs
  tools: [
    tool({
      name: 'log_drinks',
      description: 'Logs the drinks consumed by the user and calculates standard units.',
      parameters: {
        type: 'object',
        properties: {
          drinkType: {
            type: 'string',
            enum: ['beer', 'wine', 'hard_liquor', 'cocktail'],
            description: 'The type of alcoholic drink.',
          },
          amount: {
            type: 'number',
            description: 'Number of drinks of this type per week.',
            minimum: 0,
          },
          drinkSize: {
            type: 'string',
            enum: ['standard', 'large', 'small'],
            description: 'Size of the drink (standard = 12oz beer, 5oz wine, 1.5oz liquor, regular cocktail)',
          },
          frequency: {
            type: 'string',
            enum: ['daily', 'few_times_week', 'weekends_only', 'binge_occasions', 'mixed_pattern'],
            description: 'Drinking frequency pattern: daily (every day), few_times_week (2-4 times per week), weekends_only (Friday-Sunday), binge_occasions (heavy drinking on specific days), mixed_pattern (combination of patterns)',
          },
          occasionType: {
            type: 'string',
            enum: ['social', 'stress', 'routine', 'celebration', 'alone', 'other'],
            description: 'What type of occasion or situation triggers this drinking pattern',
          },
        },
        required: ['drinkType', 'amount', 'frequency'],
        additionalProperties: false,
      },
      execute: async (input: any, context: any) => {
        const { drinkType, amount, drinkSize = 'standard', frequency, occasionType = 'other' } = input;
        
        // Calculate standard units
        let standardUnits = calculateStandardUnits(drinkType, amount);
        
        // Adjust for drink size
        if (drinkSize === 'large') {
          standardUnits *= 1.5;
        } else if (drinkSize === 'small') {
          standardUnits *= 0.75;
        }
        
        const logEntry = {
          drinkType,
          amount,
          drinkSize,
          frequency,
          occasionType,
          standardUnits: Math.round(standardUnits * 10) / 10, // Round to 1 decimal place
        };
        
        // Add to global tracking
        totalStandardUnits += logEntry.standardUnits;
        drinkLog.push(logEntry);
        
        // Enhanced logging
        const frequencyText = frequency.replace('_', ' ');
        const logMessage = `DRINK LOGGED: ${amount} ${drinkType}(s) (${drinkSize}) - ${frequencyText} - ${occasionType} occasions = ${logEntry.standardUnits} standard units | Running total: ${Math.round(totalStandardUnits * 10) / 10} standard units per week`;
        
        if (context) {
          if (context.addTranscriptBreadcrumb) {
            context.addTranscriptBreadcrumb(logMessage, {
              ...logEntry,
              runningTotal: Math.round(totalStandardUnits * 10) / 10
            });
          }
          if (context.sendEvent) {
            context.sendEvent({ 
              type: 'drink_logged', 
              ...logEntry,
              runningTotal: Math.round(totalStandardUnits * 10) / 10
            });
          }
        }
        
        console.log('🍺 DRINK LOGGED:', logMessage);
        
        return `Logged: ${amount} ${drinkType} (${logEntry.standardUnits} units)`;
      },
    }),
    tool({
      name: 'calculate_total_standard_units',
      description: 'Calculates and displays the total standard units consumed per week based on all logged drinks.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      execute: async (_input: any) => {
        const summary = {
          totalStandardUnits: Math.round(totalStandardUnits * 10) / 10,
          drinkBreakdown: drinkLog,
          totalDrinks: drinkLog.reduce((sum, entry) => sum + entry.amount, 0)
        };
        
        console.log('📊 BASELINE CALCULATED:', summary);
        
        // Reset for next session
        totalStandardUnits = 0;
        drinkLog = [];
        
        return `Total: ${summary.totalStandardUnits} standard drinks per week (${summary.totalDrinks} drinks)`;
      },
    }),
  ],
  handoffDescription: 'Agent that calculates baseline alcohol consumption',
});

