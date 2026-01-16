/**
 * Prompt Templates Utility
 *
 * Handles loading and managing agent prompt templates
 */

/**
 * PQ (Personalization Quiz) Data interface
 * These values are injected into prompt templates
 */
export interface PQData {
  memberName: string;
  mainSubstance: string;
  acuityLevel: string;
  primaryGoal: string;
  motivation: string;
  learningTopics: string;
  personalizedApproach: string;
  carePreferences: string;
  drinkingLogs: string;
  allQuestionsAndAnswers: string;
}

/**
 * Default PQ data values for testing
 */
export const DEFAULT_PQ_DATA: PQData = {
  memberName: 'Jack',
  mainSubstance: 'alcohol',
  acuityLevel: 'moderate',
  primaryGoal: 'drink less and maintain a healthy lifestyle',
  motivation: 'wanting to be more present for family and improve overall health',
  learningTopics: 'understanding triggers, building healthier habits, stress management',
  personalizedApproach: 'supportive and non-judgmental',
  carePreferences: 'empathetic and understanding',
  drinkingLogs: '[3, 2, 4, 1, 3, 2, 0]',
  allQuestionsAndAnswers: `Q: How ready are you to make a change?
A: I'm curious about changing but haven't taken steps yet.

Q: What's been your biggest challenge?
A: I've found it hard to reduce drinking on my own.

Q: What's your specific focus?
A: Moderation - fewer drinks per typical drinking day.

Q: How do you prefer to receive support?
A: I prefer supportive and non-judgmental guidance.`,
};

/**
 * Substitute template variables in a prompt string
 * Replaces {{variableName}} with corresponding values from PQ data
 */
export function substitutePromptVariables(prompt: string, pqData: Partial<PQData>): string {
  const data = { ...DEFAULT_PQ_DATA, ...pqData };

  let result = prompt;

  // Replace all {{variableName}} patterns
  Object.entries(data).forEach(([key, value]) => {
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(pattern, String(value));
  });

  return result;
}

/**
 * Available prompt templates
 */
export const PROMPT_TEMPLATES = {
  INTAKE_CALL_PROMPT: 'intake_call_prompt',
  GAD_PHQ2_PROMPT: 'gad_phq2_prompt',
  DRY_JANUARY_PROMPT: 'dry_january_prompt',
  // Add more templates here in the future
} as const;

export type PromptTemplateKey = typeof PROMPT_TEMPLATES[keyof typeof PROMPT_TEMPLATES];

/**
 * Load a prompt template from the public directory
 */
export async function loadPromptTemplate(templateKey: PromptTemplateKey): Promise<string> {
  try {
    const response = await fetch(`/prompts/${templateKey}.txt`);
    
    if (!response.ok) {
      throw new Error(`Failed to load prompt template: ${response.statusText}`);
    }
    
    const content = await response.text();
    return content.trim();
  } catch (error) {
    console.error(`Error loading prompt template ${templateKey}:`, error);
    throw error;
  }
}

/**
 * Get a list of available prompt templates
 */
export function getAvailableTemplates(): Array<{ key: PromptTemplateKey; label: string; description: string }> {
  return [
    {
      key: PROMPT_TEMPLATES.INTAKE_CALL_PROMPT,
      label: 'Intake Call',
      description: 'Complete voice intake flow prompt with screen-by-screen instructions for post-web personalization quiz journey (447 lines)',
    },
    {
      key: PROMPT_TEMPLATES.GAD_PHQ2_PROMPT,
      label: 'Mental Health Screening',
      description: 'Mental health screening assessment with strict validation and navigation rules (185 lines)',
    },
    {
      key: PROMPT_TEMPLATES.DRY_JANUARY_PROMPT,
      label: 'Dry January Intake Call',
      description: 'Dry January program intake call covering goals, motivations, support preferences, and check-in habits',
    },
    // Add more templates here as they become available
  ];
}

/**
 * Load the intake call prompt template
 * This is the default template used for voice intake flows
 */
export async function loadIntakeCallPrompt(): Promise<string> {
  return loadPromptTemplate(PROMPT_TEMPLATES.INTAKE_CALL_PROMPT);
}

/**
 * Load the GAD-2 / PHQ-2 mental health screening prompt template
 */
export async function loadGadPhq2Prompt(): Promise<string> {
  return loadPromptTemplate(PROMPT_TEMPLATES.GAD_PHQ2_PROMPT);
}

/**
 * Load the Dry January intake call prompt template
 */
export async function loadDryJanuaryPrompt(): Promise<string> {
  return loadPromptTemplate(PROMPT_TEMPLATES.DRY_JANUARY_PROMPT);
}

