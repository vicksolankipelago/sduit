/**
 * Voice Agent Configuration
 * 
 * Central export point for all voice agent configurations
 */

// Export the complete onboarding scenario and individual agents
export {
  pelagoOnboardingScenario,
  greeterAgent,
  motivationAgent,
  baselineCalculationAgent
} from './pelagoOnboarding';

// Export Azure adapter utilities
export {
  type AzureAgentConfig,
  type AzureTool,
  getAgentConfig,
  azureAgents,
  getNextAgent,
  checkManualHandoff,
  createSessionUpdate
} from './azureAgentAdapter';
