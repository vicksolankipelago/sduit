/**
 * Pelago Onboarding Scenario
 * 
 * This file orchestrates the multi-agent conversation flow for Pelago's
 * substance use recovery onboarding process.
 * 
 * Agent Flow:
 * 1. greeterAgent - Welcomes user and identifies substance
 * 2. motivationAgent - Explores motivations and goals
 * 3. baselineCalculationAgent - Calculates consumption baseline and closes
 * 
 * Each agent is defined in its own file for better organization.
 */

import { greeterAgent } from './greeterAgent';
import { motivationAgent } from './motivationAgent';
import { baselineCalculationAgent } from './baselineCalculationAgent';

/**
 * Configure handoffs between agents
 * This must be done here to avoid circular dependencies
 */

// Greeter hands off to Motivation agent after substance is logged
greeterAgent.handoffs = [motivationAgent];

// Motivation agent hands off to Baseline Calculation after motivations are logged
motivationAgent.handoffs = [baselineCalculationAgent];

// Baseline Calculation is the terminal agent (no handoffs)
// baselineCalculationAgent.handoffs = [] (already set in agent file)

/**
 * Export the complete onboarding scenario
 * This array defines the agent flow in order
 */
export const pelagoOnboardingScenario = [
  greeterAgent,
  motivationAgent,
  baselineCalculationAgent
];

/**
 * Export individual agents for direct access
 */
export {
  greeterAgent,
  motivationAgent,
  baselineCalculationAgent
};
