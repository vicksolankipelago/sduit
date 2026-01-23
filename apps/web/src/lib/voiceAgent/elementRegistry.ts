/**
 * Element Registry
 * 
 * Maps element types to React components for dynamic rendering
 */

import React from 'react';
import { ElementType } from '../../types/journey';

// Import all element components
import { ButtonElement } from '../../components/voiceAgent/elements/ButtonElement';
import { TextBlockElement } from '../../components/voiceAgent/elements/TextBlockElement';
import { ImageElement } from '../../components/voiceAgent/elements/ImageElement';
import { SpacerElement } from '../../components/voiceAgent/elements/SpacerElement';
import { LoadingViewElement } from '../../components/voiceAgent/elements/LoadingViewElement';
import { ImageCardElement } from '../../components/voiceAgent/elements/ImageCardElement';
import { TextCardElement } from '../../components/voiceAgent/elements/TextCardElement';
import { ChecklistCardElement } from '../../components/voiceAgent/elements/ChecklistCardElement';
import { ToggleCardElement } from '../../components/voiceAgent/elements/ToggleCardElement';
import { CareCallCardElement } from '../../components/voiceAgent/elements/CareCallCardElement';
import { QuoteCardElement } from '../../components/voiceAgent/elements/QuoteCardElement';
import { LargeQuestionElement } from '../../components/voiceAgent/elements/LargeQuestionElement';
import { CheckboxButtonElement } from '../../components/voiceAgent/elements/CheckboxButtonElement';
import { ImageCheckboxButtonElement } from '../../components/voiceAgent/elements/ImageCheckboxButtonElement';
import { CircularStepperElement } from '../../components/voiceAgent/elements/CircularStepperElement';
import { MiniWidgetElement } from '../../components/voiceAgent/elements/MiniWidgetElement';
import { AnimatedImageElement } from '../../components/voiceAgent/elements/AnimatedImageElement';
import { AnimatedComponentsElement } from '../../components/voiceAgent/elements/AnimatedComponentsElement';
import { WeekCheckinSummaryElement } from '../../components/voiceAgent/elements/WeekCheckinSummaryElement';
import { AgentMessageCardElement } from '../../components/voiceAgent/elements/AgentMessageCardElement';
import { OpenQuestionElement } from '../../components/voiceAgent/elements/OpenQuestionElement';
import { OrbElement } from '../../components/voiceAgent/elements/OrbElement';

/**
 * Element Registry - Maps element types to React components
 */
export const ElementRegistry: Record<ElementType, React.ComponentType<any>> = {
  'button': ButtonElement,
  'textBlock': TextBlockElement,
  'image': ImageElement,
  'spacer': SpacerElement,
  'loadingView': LoadingViewElement,
  'imageCard': ImageCardElement,
  'textCard': TextCardElement,
  'checklistCard': ChecklistCardElement,
  'toggleCard': ToggleCardElement,
  'careCall': CareCallCardElement,
  'quoteCard': QuoteCardElement,
  'largeQuestion': LargeQuestionElement,
  'checkboxButton': CheckboxButtonElement,
  'imageCheckboxButton': ImageCheckboxButtonElement,
  'circularStepper': CircularStepperElement,
  'miniWidget': MiniWidgetElement,
  'animatedImage': AnimatedImageElement,
  'animatedComponents': AnimatedComponentsElement,
  'weekCheckinSummary': WeekCheckinSummaryElement,
  'agentMessageCard': AgentMessageCardElement,
  'openQuestion': OpenQuestionElement,
  'orb': OrbElement,
};

/**
 * Get element component by type
 */
export function getElementComponent(type: ElementType): React.ComponentType<any> | undefined {
  return ElementRegistry[type];
}

/**
 * Check if element type is registered
 */
export function isElementTypeRegistered(type: ElementType): boolean {
  return type in ElementRegistry;
}

/**
 * Get all registered element types
 */
export function getRegisteredElementTypes(): ElementType[] {
  return Object.keys(ElementRegistry) as ElementType[];
}

/**
 * Element metadata for UI builder
 * Note: Uses 'defaultData' to match iOS SDUI implementation
 */
export interface ElementMetadata {
  type: ElementType;
  displayName: string;
  category: 'core' | 'card' | 'interactive' | 'advanced';
  icon: string;
  description: string;
  defaultData: Record<string, any>;
  defaultStyle?: Record<string, any>;
}

/**
 * Element Metadata Registry
 * Note: Uses 'defaultData' to match iOS SDUI implementation
 */
export const ElementMetadataRegistry: Record<ElementType, ElementMetadata> = {
  'button': {
    type: 'button',
    displayName: 'Button',
    category: 'core',
    icon: '🔘',
    description: 'Interactive button with multiple styles',
    defaultData: { id: '', title: 'Button', isDisabled: false },
    defaultStyle: { style: 'primary', size: 'large' },
  },
  'textBlock': {
    type: 'textBlock',
    displayName: 'Text Block',
    category: 'core',
    icon: '📝',
    description: 'Text content with various styles',
    defaultData: { id: '', text: 'Text content' },
    defaultStyle: { style: 'body1', alignment: 'leading' },
  },
  'image': {
    type: 'image',
    displayName: 'Image',
    category: 'core',
    icon: '🖼️',
    description: 'Display images',
    defaultData: { id: '', imageName: 'ColourSuccess' },
    defaultStyle: { width: 200, height: 200, contentMode: 'fit' },
  },
  'spacer': {
    type: 'spacer',
    displayName: 'Spacer',
    category: 'core',
    icon: '⬜',
    description: 'Flexible or fixed spacing',
    defaultData: { id: '' },
    defaultStyle: { height: null, isFlexible: true, direction: 'vertical' },
  },
  'loadingView': {
    type: 'loadingView',
    displayName: 'Loading',
    category: 'core',
    icon: '⏳',
    description: 'Loading indicator',
    defaultData: { id: '' },
  },
  'imageCard': {
    type: 'imageCard',
    displayName: 'Image Card',
    category: 'card',
    icon: '🃏',
    description: 'Card with image, title, and description',
    defaultData: { id: '', title: 'Title', description: 'Description' },
    defaultStyle: { imageName: 'ColourManThumbsUp', imageWidth: 72, imageHeight: 72, backgroundColor: 'backgroundTeaGreen', cornerRadius: 8 },
  },
  'textCard': {
    type: 'textCard',
    displayName: 'Text Card',
    category: 'card',
    icon: '🗂️',
    description: 'Caption + text card with Pelago styling',
    defaultData: { id: '', title: 'Caption', content: 'Summary text' },
    defaultStyle: { backgroundColor: 'backgroundLightMintGreen', borderColor: 'backgroundLightMintGreen', captionColor: 'textGlobalSecondary', textColor: 'textGlobalPrimary', borderWidth: 1, cornerRadius: 16 },
  },
  'checklistCard': {
    type: 'checklistCard',
    displayName: 'Checklist Card',
    category: 'card',
    icon: '✅',
    description: 'Card with checklist items',
    defaultData: { id: '', title: 'Checklist', itemTitles: ['Item 1', 'Item 2'] },
    defaultStyle: { backgroundColor: 'backgroundLightTeaGreen', cornerRadius: 12 },
  },
  'toggleCard': {
    type: 'toggleCard',
    displayName: 'Toggle Card',
    category: 'card',
    icon: '🔘',
    description: 'Card with toggle switch',
    defaultData: { id: '', title: 'Toggle', description: 'Description', isToggled: false },
    defaultStyle: { backgroundColor: 'secondaryDisabled', borderColor: 'secondaryDefault', cornerRadius: 8 },
  },
  'careCall': {
    type: 'careCall',
    displayName: 'Care Call Card',
    category: 'card',
    icon: '📞',
    description: 'Telemedicine appointment card',
    defaultData: {
      id: '',
      reason: 'Welcome Call',
      time: new Date().toISOString(),
      participant: 'Care Team',
      duration: 30,
      callType: 'video call',
      ctaTitle: 'Join Call',
      canBeJoined: false,
    },
    defaultStyle: { backgroundColor: 'backgroundLightPink', borderColor: 'punchPink' },
  },
  'quoteCard': {
    type: 'quoteCard',
    displayName: 'Quote Card',
    category: 'card',
    icon: '💬',
    description: 'Quote card with optional image',
    defaultData: { id: '', message: 'Quote message', jobTitle: 'Author' },
  },
  'largeQuestion': {
    type: 'largeQuestion',
    displayName: 'Large Question',
    category: 'interactive',
    icon: '❓',
    description: 'Question with multiple choice options',
    defaultData: {
      id: '',
      title: 'Question?',
      options: [
        { id: 'opt1', title: 'Option 1', description: 'Description' },
        { id: 'opt2', title: 'Option 2', description: 'Description' },
      ],
    },
  },
  'checkboxButton': {
    type: 'checkboxButton',
    displayName: 'Checkbox Button',
    category: 'interactive',
    icon: '☑️',
    description: 'Simple checkbox button',
    defaultData: { id: '', title: 'Checkbox', option: 'option1', isSelected: false },
    defaultStyle: { height: 24 },
  },
  'imageCheckboxButton': {
    type: 'imageCheckboxButton',
    displayName: 'Image Checkbox',
    category: 'interactive',
    icon: '🖼️☑️',
    description: 'Checkbox with image and caption',
    defaultData: {
      id: '',
      title: 'Title',
      caption: 'Caption',
      imageName: 'icon',
      backgroundColor: 'backgroundTeaGreen',
      option: 'option1',
      isSelected: false,
    },
    defaultStyle: { imageDimension: 'icon', recolor: true },
  },
  'circularStepper': {
    type: 'circularStepper',
    displayName: 'Stepper',
    category: 'interactive',
    icon: '🔢',
    description: 'Numeric stepper with +/- buttons',
    defaultData: { id: '', value: 0, minValue: 0, maxValue: 10, step: 1, label: 'Count' },
  },
  'miniWidget': {
    type: 'miniWidget',
    displayName: 'Mini Widget',
    category: 'interactive',
    icon: '📊',
    description: 'Compact widget card',
    defaultData: { id: '', title: 'Widget', content: '0' },
    defaultStyle: { backgroundColor: 'backgroundLightCard', textColor: 'textGlobalPrimary' },
  },
  'animatedImage': {
    type: 'animatedImage',
    displayName: 'Animated Image',
    category: 'advanced',
    icon: '🎬',
    description: 'Lottie animation',
    defaultData: { id: '', lottieName: 'animation' },
    defaultStyle: { width: 200, height: 200 },
  },
  'animatedComponents': {
    type: 'animatedComponents',
    displayName: 'Animated Components',
    category: 'advanced',
    icon: '✨',
    description: 'Sequential element animations',
    defaultData: { id: '', elements: [] },
    defaultStyle: { duration: 2.0, loop: false, autoStart: true, direction: 'forward', curve: 'easeInOut' },
  },
  'weekCheckinSummary': {
    type: 'weekCheckinSummary',
    displayName: 'Week Summary',
    category: 'advanced',
    icon: '📅',
    description: 'Weekly check-in summary',
    defaultData: { id: '', weekNumber: 1, checkinCount: 0, targetCount: 7 },
  },
  'agentMessageCard': {
    type: 'agentMessageCard',
    displayName: 'Agent Message',
    category: 'advanced',
    icon: '🤖',
    description: 'Voice agent message bubble',
    defaultData: { id: '', message: 'Message', agentName: 'Agent', avatar: '🤖' },
    defaultStyle: { backgroundColor: 'backgroundLightCard', cornerRadius: 12 },
  },
  'openQuestion': {
    type: 'openQuestion',
    displayName: 'Open Question',
    category: 'interactive',
    icon: '💬',
    description: 'Open-ended question that shows summary after recording input',
    defaultData: { id: '', question: 'What would you like to share?' },
    defaultStyle: {},
  },
  'orb': {
    type: 'orb',
    displayName: 'Voice Orb',
    category: 'interactive',
    icon: '🔮',
    description: '3D animated orb with audio reactivity for voice agent visualization',
    defaultData: {
      id: '',
      colors: ['#A2CC6E', '#DDF1C4'],
      agentState: null,
      volumeMode: 'auto',
    },
    defaultStyle: { size: 'medium' },
  },
};

/**
 * Get element metadata by type
 */
export function getElementMetadata(type: ElementType): ElementMetadata | undefined {
  return ElementMetadataRegistry[type];
}

/**
 * Get elements by category
 */
export function getElementsByCategory(category: ElementMetadata['category']): ElementMetadata[] {
  return Object.values(ElementMetadataRegistry).filter(meta => meta.category === category);
}

