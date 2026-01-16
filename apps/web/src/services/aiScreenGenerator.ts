/**
 * AI Screen Generator Service
 * 
 * Uses AWS Bedrock (Claude Sonnet 4.5) via backend API to intelligently generate 
 * screen suggestions based on agent prompts and system configuration.
 */

import { Screen, ElementConfig, ElementType } from '../types/journey';
import { SCREEN_TEMPLATES } from '../lib/voiceAgent/screenTemplates';
import { ElementMetadataRegistry } from '../lib/voiceAgent/elementRegistry';
import { v4 as uuidv4 } from 'uuid';

export interface ScreenGenerationRequest {
  systemPrompt: string;
  agentPrompt: string;
  agentName: string;
  existingScreens?: Screen[];
  customInstructions?: string;
}

export interface ScreenSuggestion {
  screenType: 'welcome' | 'question' | 'info' | 'settings' | 'custom';
  title: string;
  description: string;
  elements: ElementConfig[];
  reasoning: string;
}

export interface AIGenerationResponse {
  screens: ScreenSuggestion[];
}

/**
 * Create an element using registry defaults merged with customizations
 * This ensures all required properties are present
 */
function createElement(type: ElementType, customizations: Partial<ElementConfig>): ElementConfig {
  const metadata = ElementMetadataRegistry[type];
  
  if (!metadata) {
    throw new Error(`Unknown element type: ${type}`);
  }
  
  // Start with defaults from registry
  const element: ElementConfig = {
    type,
    state: {
      ...metadata.defaultData,
      id: customizations.state?.id || `${type}_${uuidv4()}`,
      // Merge custom state properties
      ...(customizations.state || {}),
    },
  };
  
  // Add style if defaults exist or customizations provided
  if (metadata.defaultStyle || customizations.style) {
    element.style = {
      ...(metadata.defaultStyle || {}),
      ...(customizations.style || {}),
    };
  }
  
  // Add events if provided
  if (customizations.events) {
    element.events = customizations.events;
  }
  
  return element;
}

/**
 * Process AI-generated elements and ensure they have all required properties
 */
function processAIElements(aiElements: any[]): ElementConfig[] {
  return aiElements.map(el => {
    try {
      return createElement(el.type as ElementType, {
        state: el.state,
        style: el.style,
        events: el.events,
      });
    } catch (error) {
      console.warn(`Failed to create element of type ${el.type}:`, error);
      // Return a text block as fallback
      return createElement('textBlock', {
        state: { id: `fallback_${uuidv4()}`, text: `[Invalid element: ${el.type}]` },
      });
    }
  });
}

/**
 * Analyse agent prompts and generate screen suggestions using AI (via backend)
 */
export async function generateScreensFromPrompts(
  request: ScreenGenerationRequest
): Promise<ScreenSuggestion[]> {
  
  try {
    console.log('📡 Calling backend API to generate screens...');
    
    // Call backend endpoint via voice-api proxy (routes to localhost:3001)
    const response = await fetch('/voice-api/generate-screens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemPrompt: request.systemPrompt,
        agentPrompt: request.agentPrompt,
        agentName: request.agentName,
        existingScreens: request.existingScreens?.map(s => ({ title: s.title }))
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Generated ${data.suggestions.length} screen suggestions`);
    
    // Process suggestions to ensure all elements have proper defaults
    const processedSuggestions = data.suggestions.map((suggestion: ScreenSuggestion) => ({
      ...suggestion,
      elements: processAIElements(suggestion.elements || []),
    }));
    
    return processedSuggestions;
    
  } catch (error) {
    console.error('Error generating screens:', error);
    throw error;
  }
}

/**
 * Convert a screen suggestion to a full Screen object
 */
export function suggestionToScreen(suggestion: ScreenSuggestion): Screen {
  const baseTemplate = SCREEN_TEMPLATES.find(t => t.id === suggestion.screenType);
  
  if (baseTemplate && suggestion.screenType !== 'custom') {
    // Use template as base and customise
    const screen = baseTemplate.createScreen();
    screen.title = suggestion.title;
    screen.id = `ai_${suggestion.screenType}_${uuidv4()}`;
    
    // Replace body section elements with AI-generated ones
    const bodySection = screen.sections.find(s => s.position === 'body');
    if (bodySection && suggestion.elements.length > 0) {
      bodySection.elements = suggestion.elements.map(el => ({
        ...el,
        state: {
          ...el.state,
          id: el.state.id || `element_${uuidv4()}`
        }
      }));
    }
    
    return screen;
  }
  
  // Create custom screen from scratch
  return {
    id: `ai_custom_${uuidv4()}`,
    title: suggestion.title,
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: suggestion.elements.map(el => ({
          ...el,
          state: {
            ...el.state,
            id: el.state.id || `element_${uuidv4()}`
          }
        }))
      },
      {
        id: 'bottom-section',
        position: 'fixed-bottom',
        layout: 'stack',
        direction: 'vertical',
        scrollable: false,
        elements: [
          {
            type: 'button',
            state: { id: 'continue-btn', title: 'Continue', isDisabled: false },
            style: { style: 'primary', size: 'large' },
            events: [
              {
                id: 'continue_event',
                type: 'onSelected',
                action: [
                  {
                    type: 'navigation',
                    deeplink: 'https://links.pelagohealth.com/module/next-screen',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    events: [],
  };
}

/**
 * Validate that a screen suggestion has the required structure
 */
export function validateScreenSuggestion(suggestion: any): suggestion is ScreenSuggestion {
  return (
    suggestion &&
    typeof suggestion.screenType === 'string' &&
    typeof suggestion.title === 'string' &&
    typeof suggestion.description === 'string' &&
    typeof suggestion.reasoning === 'string' &&
    Array.isArray(suggestion.elements)
  );
}

