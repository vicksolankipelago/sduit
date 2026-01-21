/**
 * Screen Templates
 * 
 * Pre-built screen templates for common patterns
 */

import { Screen } from '../../types/journey';

/**
 * Create a welcome/intro screen template
 */
export function createWelcomeScreenTemplate(): Screen {
  return {
    id: 'welcome',
    title: 'Welcome',
    hidesBackButton: true,
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: false,
        elements: [
          {
            type: 'spacer',
            state: { id: 'top-spacer' },
            style: { height: null, isFlexible: true, direction: 'vertical' },
          },
          {
            type: 'textBlock',
            state: { id: 'welcome-title', text: 'Welcome to your journey' },
            style: { style: 'heading1', alignment: 'center' },
          },
          {
            type: 'spacer',
            state: { id: 'title-spacer' },
            style: { height: 16, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'textBlock',
            state: { id: 'welcome-subtitle', text: 'Let\'s get started' },
            style: { style: 'body1', alignment: 'center', color: 'secondary' },
          },
          {
            type: 'spacer',
            state: { id: 'bottom-spacer' },
            style: { height: null, isFlexible: true, direction: 'vertical' },
          },
        ],
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
 * Create a question screen template
 */
export function createQuestionScreenTemplate(): Screen {
  return {
    id: 'question',
    title: 'Question',
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: [
          {
            type: 'largeQuestion',
            state: {
              id: 'question-1',
              title: 'What would you like to focus on?',
              options: [
                { id: 'option-1', title: 'Option 1', description: 'Description for option 1' },
                { id: 'option-2', title: 'Option 2', description: 'Description for option 2' },
                { id: 'option-3', title: 'Option 3', description: 'Description for option 3' },
              ],
            },
            events: [
              {
                id: 'option_selected',
                type: 'onSelected',
                action: [
                  {
                    type: 'stateUpdate',
                    scope: 'screen',
                    updates: { selectedOption: 'value' },
                  },
                ],
              },
            ],
          },
        ],
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
 * Create an information/card screen template
 */
export function createInfoScreenTemplate(): Screen {
  return {
    id: 'info',
    title: 'Information',
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: [
          {
            type: 'textBlock',
            state: { id: 'header', text: 'Your Program' },
            style: { style: 'heading2', alignment: 'center' },
          },
          {
            type: 'spacer',
            state: { id: 'header-spacer' },
            style: { height: 24, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'imageCard',
            state: {
              id: 'welcome-card',
              title: 'Welcome {$moduleData.userName}!',
              description: 'We\'re here to support you on your journey.',
            },
            style: {
              imageName: 'Success',
              imageWidth: 72,
              imageHeight: 72,
              backgroundColor: 'backgroundTeaGreen',
              cornerRadius: 8,
            },
          },
          {
            type: 'spacer',
            state: { id: 'card-spacer' },
            style: { height: 16, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'checklistCard',
            state: {
              id: 'next-steps',
              title: 'Next Steps',
              itemTitles: [
                'Complete your profile',
                'Set your goals',
                'Start your journey',
              ],
            },
            style: {
              backgroundColor: 'backgroundLightTeaGreen',
              cornerRadius: 12,
            },
          },
        ],
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
                id: 'next_step_event',
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
 * Create a settings/toggle screen template
 */
export function createSettingsScreenTemplate(): Screen {
  return {
    id: 'settings',
    title: 'Settings',
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: [
          {
            type: 'textBlock',
            state: { id: 'header', text: 'Preferences' },
            style: { style: 'heading2', alignment: 'leading' },
          },
          {
            type: 'spacer',
            state: { id: 'header-spacer' },
            style: { height: 16, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'toggleCard',
            state: {
              id: 'notifications-toggle',
              title: 'Turn on notifications',
              description: 'Get notified about important updates',
              label: 'Recommended',
              isToggled: true,
            },
            style: {
              icon: 'Notification',
              backgroundColor: 'secondaryDisabled',
              borderColor: 'secondaryDefault',
              cornerRadius: 8,
            },
            events: [
              {
                id: 'notif_toggle_on',
                type: 'onToggleOn',
                action: [
                  {
                    type: 'stateUpdate',
                    scope: 'module',
                    updates: { notificationsEnabled: true },
                  },
                ],
              },
              {
                id: 'notif_toggle_off',
                type: 'onToggleOff',
                action: [
                  {
                    type: 'stateUpdate',
                    scope: 'module',
                    updates: { notificationsEnabled: false },
                  },
                ],
              },
            ],
          },
        ],
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
                id: 'save_settings_event',
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
 * Create a journey completed screen template
 * This screen automatically ends the call when it appears
 */
export function createJourneyCompletedScreenTemplate(): Screen {
  return {
    id: 'journey-completed',
    title: 'Journey Completed',
    hidesBackButton: true,
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: false,
        elements: [
          {
            type: 'spacer',
            state: { id: 'top-spacer' },
            style: { height: null, isFlexible: true, direction: 'vertical' },
          },
          {
            type: 'image',
            state: { id: 'success-image' },
            style: {
              imageName: 'Success',
              width: 200,
              height: 200,
              alignment: 'center',
            },
          },
          {
            type: 'spacer',
            state: { id: 'image-spacer' },
            style: { height: 32, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'textBlock',
            state: { id: 'completed-title', text: 'All done!' },
            style: { style: 'heading1', alignment: 'center' },
          },
          {
            type: 'spacer',
            state: { id: 'title-spacer' },
            style: { height: 16, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'textBlock',
            state: { id: 'completed-subtitle', text: 'Thank you for completing your journey. The call will end shortly.' },
            style: { style: 'body1', alignment: 'center', color: 'secondary' },
          },
          {
            type: 'spacer',
            state: { id: 'bottom-spacer' },
            style: { height: null, isFlexible: true, direction: 'vertical' },
          },
        ],
      },
      {
        id: 'bottom-section',
        position: 'fixed-bottom',
        layout: 'stack',
        direction: 'vertical',
        scrollable: false,
        elements: [
          {
            type: 'textCard',
            state: {
              id: 'info-card',
              title: '',
              content: 'Your responses have been saved',
            },
            style: {
              backgroundColor: 'backgroundLightTeaGreen',
              borderColor: 'backgroundMintGreen',
              showCheckmark: true,
              cornerRadius: 8,
            },
          },
        ],
      },
    ],
    events: [
      {
        id: 'auto_close_event',
        type: 'onAppear',
        action: [
          {
            type: 'closeModule',
            flowCompleted: true,
            parameters: {
              reason: 'journey_completed',
              autoClose: true,
            },
          },
        ],
      },
    ],
  };
}

/**
 * Get all available templates
 */
export interface ScreenTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  createScreen: () => Screen;
}

export const SCREEN_TEMPLATES: ScreenTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome Screen',
    description: 'Simple welcome screen with centered text and CTA',
    icon: '👋',
    createScreen: createWelcomeScreenTemplate,
  },
  {
    id: 'question',
    name: 'Question Screen',
    description: 'Multiple choice question with large options',
    icon: '❓',
    createScreen: createQuestionScreenTemplate,
  },
  {
    id: 'info',
    name: 'Information Screen',
    description: 'Display cards with information and checklist',
    icon: '📋',
    createScreen: createInfoScreenTemplate,
  },
  {
    id: 'settings',
    name: 'Settings Screen',
    description: 'Settings screen with toggles',
    icon: '⚙️',
    createScreen: createSettingsScreenTemplate,
  },
  {
    id: 'journey-completed',
    name: 'Journey Completed',
    description: 'Final screen that automatically ends the call',
    icon: '✅',
    createScreen: createJourneyCompletedScreenTemplate,
  },
];

/**
 * Get template by ID
 */
export function getScreenTemplate(templateId: string): ScreenTemplate | undefined {
  return SCREEN_TEMPLATES.find(t => t.id === templateId);
}

