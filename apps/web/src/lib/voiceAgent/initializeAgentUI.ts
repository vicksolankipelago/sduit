import { registerFunction, registerAgentFunction } from './agentUIRegistry';
import SubstanceSelectionCard from '../../components/voiceAgent/SubstanceSelectionCard';
import MotivationGoalCard from '../../components/voiceAgent/MotivationGoalCard';
import DrinkLogCard from '../../components/voiceAgent/DrinkLogCard';

// Initialise all UI component registrations for the Pelago onboarding flow
export function initializePelagoUI() {
  // Register UI for substance selection function (global)
  registerFunction('log_substance', SubstanceSelectionCard, {
    type: 'card',
    positioning: { position: 'center', offset: { y: 180 } }, // Position below the ovals
    animation: { entrance: 'slide-in-bottom', duration: 400 },
    behavior: { 
      autoDismiss: true, 
      dismissDelay: 8000, 
      dismissOnClick: true,
      dismissOnEscape: true 
    }
  });

  // Register UI for motivation/goal logging function (global)
  registerFunction('log_motivation_or_goal', MotivationGoalCard, {
    type: 'card',
    positioning: { position: 'center', offset: { y: 180 } }, // Same position as substance card
    animation: { entrance: 'slide-in-bottom', duration: 400, delay: 150 },
    behavior: { 
      autoDismiss: true, 
      dismissDelay: 10000, 
      dismissOnClick: true,
      dismissOnEscape: true,
      allowMultiple: true // Allow multiple motivations/goals to be shown
    }
  });

  // Register UI for drink logging function (global)
  registerFunction('log_drinks', DrinkLogCard, {
    type: 'card',
    positioning: { position: 'center', offset: { y: 180 } }, // Same position
    animation: { entrance: 'slide-in-bottom', duration: 400, delay: 200 },
    behavior: { 
      autoDismiss: true, 
      dismissDelay: 12000, // Show longer for drink logs since they have more info
      dismissOnClick: true,
      dismissOnEscape: true,
      allowMultiple: true
    }
  });

  // Agent-specific registrations (these take precedence over global function registrations)
  
  // Greeter agent substance selection (same as global but could be customised)
  registerAgentFunction('greeter', 'log_substance', SubstanceSelectionCard, {
    type: 'card',
    positioning: { position: 'center', offset: { y: 180 } },
    animation: { entrance: 'slide-in-bottom', duration: 400 },
    behavior: { 
      autoDismiss: true, 
      dismissDelay: 8000, 
      dismissOnClick: true,
      dismissOnEscape: true 
    }
  });

  // Motivation agent specific registration
  registerAgentFunction('motivationAgent', 'log_motivation_or_goal', MotivationGoalCard, {
    type: 'card',
    positioning: { position: 'center', offset: { y: 180 } },
    animation: { entrance: 'slide-in-bottom', duration: 400, delay: 150 },
    behavior: { 
      autoDismiss: true, 
      dismissDelay: 10000, 
      dismissOnClick: true,
      dismissOnEscape: true,
      allowMultiple: true
    }
  });

  // Baseline calculation agent specific registration
  registerAgentFunction('baselineCalculationAgent', 'log_drinks', DrinkLogCard, {
    type: 'card',
    positioning: { position: 'center', offset: { y: 180 } },
    animation: { entrance: 'slide-in-bottom', duration: 400, delay: 200 },
    behavior: { 
      autoDismiss: true, 
      dismissDelay: 12000,
      dismissOnClick: true,
      dismissOnEscape: true,
      allowMultiple: true
    }
  });

  console.log('🎨 Pelago UI components registered successfully');
}

// Function to register additional UI components dynamically
export function registerCustomUI() {
  // This can be extended to register custom UI components
  // Example:
  // registerFunction('custom_function', CustomComponent, { ... });
  
  console.log('🔧 Custom UI components can be registered here');
}

// Initialise all UI components
export function initializeAllAgentUI() {
  initializePelagoUI();
  registerCustomUI();
}
