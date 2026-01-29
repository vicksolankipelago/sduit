/**
 * useVariables Hook
 *
 * Provides access to available template variables for a journey,
 * combining default variables with any custom variables defined.
 */

import { useMemo } from 'react';
import { Journey } from '../types/journey';
import { Variable, VariableCategory, VARIABLE_CATEGORIES } from '../types/variables';
import { DEFAULT_VARIABLES, validatePromptVariables } from '../utils/promptTemplates';

interface UseVariablesResult {
  /** All available variables (default + custom) */
  variables: Variable[];
  /** Variables grouped by category */
  variablesByCategory: Record<VariableCategory, Variable[]>;
  /** Validate a prompt against available variables */
  validate: (text: string) => ReturnType<typeof validatePromptVariables>;
  /** Get a variable by name */
  getVariable: (name: string) => Variable | undefined;
  /** Check if a variable name exists */
  hasVariable: (name: string) => boolean;
}

/**
 * Hook to access and work with template variables
 * @param journey - Optional journey to include custom variables from
 */
export function useVariables(journey?: Journey | null): UseVariablesResult {
  const variables = useMemo(() => {
    const customVars = journey?.customVariables || [];
    return [...DEFAULT_VARIABLES, ...customVars];
  }, [journey?.customVariables]);

  const variablesByCategory = useMemo(() => {
    const grouped: Record<VariableCategory, Variable[]> = {
      member: [],
      goals: [],
      preferences: [],
      context: [],
      quiz: [],
      custom: [],
    };

    variables.forEach(v => {
      grouped[v.category].push(v);
    });

    return grouped;
  }, [variables]);

  const variableMap = useMemo(() => {
    return new Map(variables.map(v => [v.name, v]));
  }, [variables]);

  const validate = useMemo(() => {
    return (text: string) => validatePromptVariables(text, variables);
  }, [variables]);

  const getVariable = useMemo(() => {
    return (name: string) => variableMap.get(name);
  }, [variableMap]);

  const hasVariable = useMemo(() => {
    return (name: string) => variableMap.has(name);
  }, [variableMap]);

  return {
    variables,
    variablesByCategory,
    validate,
    getVariable,
    hasVariable,
  };
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: VariableCategory) {
  return VARIABLE_CATEGORIES[category];
}

/**
 * Get all categories in display order
 */
export function getOrderedCategories(): VariableCategory[] {
  return ['member', 'goals', 'preferences', 'context', 'quiz', 'custom'];
}
