/**
 * Variable Types
 *
 * Type definitions for the prompt template variable system.
 * Variables are placeholders in prompts that get substituted at runtime.
 */

/**
 * Variable Category
 * Groups variables for display in the variable panel
 */
export type VariableCategory =
  | 'member'      // Member information (name, acuity, substance)
  | 'goals'       // Goals and motivations
  | 'preferences' // Care and support preferences
  | 'context'     // Conversation context data
  | 'quiz'        // Quiz answer variables (populated from Personalization Quiz)
  | 'custom';     // User-defined variables

/**
 * Variable Definition
 * A template placeholder that can be used in prompts
 */
export interface Variable {
  /** camelCase identifier (e.g., "memberName") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Category for grouping in UI */
  category: VariableCategory;
  /** Optional default value (for custom variables) */
  defaultValue?: string;
  /** true if user-defined, false if built-in */
  isCustom: boolean;
}

/**
 * Variable Match
 * A single variable occurrence found in text
 */
export interface VariableMatch {
  /** Variable name without braces */
  name: string;
  /** Character positions in text */
  position: { start: number; end: number };
  /** true if variable exists in available variables */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Variable Validation Result
 * Result of validating a prompt for variable usage
 */
export interface VariableValidationResult {
  /** true if all variables are valid */
  isValid: boolean;
  /** List of all variable occurrences */
  variables: VariableMatch[];
}

/**
 * Category metadata for display
 */
export const VARIABLE_CATEGORIES: Record<VariableCategory, { label: string; icon: string }> = {
  member: { label: 'Member Info', icon: '👤' },
  goals: { label: 'Goals', icon: '🎯' },
  preferences: { label: 'Preferences', icon: '⚙️' },
  context: { label: 'Context', icon: '📋' },
  quiz: { label: 'Quiz Answers', icon: '📝' },
  custom: { label: 'Custom', icon: '✨' },
};
