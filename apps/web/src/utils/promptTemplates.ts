/**
 * Prompt Templates Utility
 *
 * Handles loading and managing agent prompt templates
 */

import { Variable, VariableMatch, VariableValidationResult } from '../types/variables';

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
 * Default PQ data values - these are fallbacks when actual quiz values aren't found
 * These should be descriptive placeholders that make it obvious substitution didn't work
 */
export const DEFAULT_PQ_DATA: PQData = {
  memberName: 'there',
  mainSubstance: '[substance from quiz]',
  acuityLevel: '[acuity level]',
  primaryGoal: '[goal from personalization quiz]',
  motivation: '[motivation from personalization quiz]',
  learningTopics: '[learning topics from personalization quiz]',
  personalizedApproach: '[preferred support approach]',
  carePreferences: '[care preferences]',
  drinkingLogs: '[drinking logs data]',
  allQuestionsAndAnswers: '[personalization quiz Q&A]',
};

export const DEFAULT_QUIZ_DATA: Record<string, string> = {
  selectedSubstances: '[selected substances from quiz]',
  feelings_alcohol: '[feelings about drinking from quiz]',
  goal_alcohol: '[goal from quiz]',
  areas_to_improve: '[areas to improve from quiz]',
  learning_topics: '[learning topics from quiz]',
  motivation: '[motivation from quiz]',
};

/**
 * Default variables derived from PQData and Quiz answers
 * These are the built-in variables available in all prompts
 */
export const DEFAULT_VARIABLES: Variable[] = [
  // Member Info
  { name: 'memberName', description: "Member's first name", category: 'member', isCustom: false },
  { name: 'mainSubstance', description: 'Primary substance of focus', category: 'member', isCustom: false },
  { name: 'acuityLevel', description: 'Member acuity level (low/moderate/high)', category: 'member', isCustom: false },
  // Legacy Goals (kept for backward compatibility)
  { name: 'primaryGoal', description: "Member's stated primary goal", category: 'goals', isCustom: false },
  { name: 'motivation', description: 'What motivates the member', category: 'goals', isCustom: false },
  { name: 'learningTopics', description: 'Topics member wants to learn about', category: 'goals', isCustom: false },
  // Legacy Preferences
  { name: 'personalizedApproach', description: 'Preferred support approach', category: 'preferences', isCustom: false },
  { name: 'carePreferences', description: 'Care style preferences', category: 'preferences', isCustom: false },
  // Legacy Context
  { name: 'drinkingLogs', description: 'Recent drinking log data', category: 'context', isCustom: false },
  { name: 'allQuestionsAndAnswers', description: 'Full Q&A history', category: 'context', isCustom: false },
  // Quiz Answer Variables (populated automatically from Personalization Quiz)
  { name: 'selectedSubstances', description: 'Substances selected in quiz (e.g., alcohol)', category: 'quiz', isCustom: false },
  { name: 'feelings_alcohol', description: 'How member feels about drinking', category: 'quiz', isCustom: false },
  { name: 'goal_alcohol', description: 'Member goal for alcohol (drink less, quit, etc.)', category: 'quiz', isCustom: false },
  { name: 'areas_to_improve', description: 'Specific areas member wants to improve', category: 'quiz', isCustom: false },
  { name: 'learning_topics', description: 'Topics member wants to learn about (from quiz)', category: 'quiz', isCustom: false },
];

/**
 * Regex pattern for matching {{variableName}} syntax
 * Supports camelCase, snake_case, and mixed naming conventions
 */
const VARIABLE_PATTERN = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;

/**
 * Extract all variable occurrences from text
 * Returns array of variable matches with positions
 */
export function extractVariablesFromText(text: string): Array<{ name: string; start: number; end: number }> {
  const matches: Array<{ name: string; start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  VARIABLE_PATTERN.lastIndex = 0;

  while ((match = VARIABLE_PATTERN.exec(text)) !== null) {
    matches.push({
      name: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

/**
 * Validate all variables in a prompt against available variables
 * Returns validation result with details for each variable
 */
export function validatePromptVariables(
  text: string,
  availableVariables: Variable[]
): VariableValidationResult {
  const extracted = extractVariablesFromText(text);
  const availableNames = new Set(availableVariables.map(v => v.name));

  const variables: VariableMatch[] = extracted.map(match => {
    const isValid = availableNames.has(match.name);
    return {
      name: match.name,
      position: { start: match.start, end: match.end },
      isValid,
      error: isValid ? undefined : `Unknown variable: ${match.name}`,
    };
  });

  return {
    isValid: variables.every(v => v.isValid),
    variables,
  };
}

/**
 * Substitute template variables in a prompt string
 * Replaces {{variableName}} with corresponding values from context data
 * 
 * Priority order (later values override earlier):
 * 1. DEFAULT_PQ_DATA - base defaults
 * 2. pqData - manual settings (deprecated, kept for backward compatibility)
 * 3. flowContext - quiz answers and runtime context (highest priority)
 */
export function substitutePromptVariables(
  prompt: string, 
  pqData: Partial<PQData>, 
  flowContext?: Record<string, any>
): string {
  const context = flowContext || {};
  
  console.log('🔄 substitutePromptVariables called');
  console.log('📊 flowContext keys:', Object.keys(context));
  console.log('📊 flowContext values:', context);
  
  // Map quiz answer keys to BOTH new and legacy variable names
  // This ensures prompts work whether they use {{goal_alcohol}} OR {{primaryGoal}}
  const quizToLegacyMapping: Record<string, string> = {
    goal_alcohol: 'primaryGoal',
    learning_topics: 'learningTopics',
    selectedSubstances: 'mainSubstance',
  };
  
  // Create a unified context that maps quiz answers to BOTH new and legacy keys
  const unifiedContext: Record<string, any> = { ...context };
  for (const [quizKey, legacyKey] of Object.entries(quizToLegacyMapping)) {
    if (context[quizKey]) {
      // If quiz answer exists, also set it as the legacy key
      unifiedContext[legacyKey] = context[quizKey];
      console.log(`🔗 Mapped ${quizKey} → ${legacyKey}: ${context[quizKey]}`);
    }
  }
  
  // Merge all data sources with flowContext having highest priority
  // Order: Legacy PQ defaults < Quiz defaults < manual pqData < unified flowContext (quiz answers mapped to both keys)
  const data = { ...DEFAULT_PQ_DATA, ...DEFAULT_QUIZ_DATA, ...pqData, ...unifiedContext };
  
  // Log which values are being used for key quiz variables
  console.log('📝 Final substitution values:', {
    feelings_alcohol: data.feelings_alcohol,
    goal_alcohol: data.goal_alcohol,
    motivation: data.motivation,
    learning_topics: data.learning_topics,
    primaryGoal: data.primaryGoal,
    learningTopics: data.learningTopics,
  });

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

