import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './VoiceAgent.css';

// Context Providers
import { TranscriptProvider } from '../contexts/voiceAgent/TranscriptContext';
import { EventProvider } from '../contexts/voiceAgent/EventContext';
import { AgentUIProvider } from '../contexts/voiceAgent/AgentUIContext';

// Hooks
import { useTranscript } from '../contexts/voiceAgent/TranscriptContext';
import { useEvent } from '../contexts/voiceAgent/EventContext';
import { useAgentUI } from '../contexts/voiceAgent/AgentUIContext';
import { useAzureWebRTCSession } from '../hooks/voiceAgent/useAzureWebRTCSession';
import { useElevenLabsSession } from '../hooks/voiceAgent/useElevenLabsSession';
import useAudioDownload from '../hooks/voiceAgent/useAudioDownload';
import { useStreamingRecording } from '../hooks/voiceAgent/useStreamingRecording';
import { usePreviewFlowRecording } from '../hooks/voiceAgent/usePreviewFlowRecording';
import { VoiceAgentAudioRouter } from '../utils/voiceAgent/audioRouting';

// Components
import AgentUIRenderer from '../components/voiceAgent/AgentUIRenderer';
import SessionLogViewer, { LogEntry } from '../components/voiceAgent/SessionLogViewer';
import MemberPersonaEditor from '../components/voiceAgent/MemberPersonaEditor';
import FeedbackSurvey from '../components/voiceAgent/FeedbackSurvey';
import VoiceControlBar, { VoiceHelpOverlay, type ActiveSpeaker } from '../components/voiceAgent/VoiceControlBar';
import { ErrorBoundary } from '../components/voiceAgent/ErrorBoundary';
import { EditIcon, SettingsIcon } from '../components/Icons';

import { ElevenLabsAudioAlignmentSnapshot, SessionStatus, TranscriptItem } from '../types/voiceAgent';
import { Journey, JourneyListItem } from '../types/journey';
import {
  createSessionExport,
  downloadSessionExport,
  downloadPrompt,
  downloadFormattedTranscript,
  downloadPromptAndTranscript
} from '../utils/transcriptExport';
import { JourneyRuntime, getStartingAgentName, setEventTriggerCallback } from '../lib/voiceAgent/journeyRuntime';
import { listJourneysForRuntime, loadJourneyForRuntime } from '../services/journeyStorage';
import { PQData, substitutePromptVariables, DEFAULT_PQ_DATA } from '../utils/promptTemplates';
import { useAuth } from '../contexts/AuthContext';
import { saveSession, DebouncedSessionSaver, fetchElevenLabsConversation } from '../services/api/sessionService';
import { captureProlificParams, storeProlificSession, getProlificSession, handleProlificCompletion, hasProlificParams, type ProlificOutcome } from '../utils/prolific';

// Mapping of quiz option IDs to readable labels for prompt interpolation
// These must match the option IDs in the Personalisation Quiz journey
const QUIZ_OPTION_LABELS: Record<string, string> = {
  // Feelings about drinking (pq-feelings-alcohol screen)
  'i_recently_cut_down_or_quit': 'recently cut down or quit drinking',
  'i_plan_to_take_steps_very_soon': 'planning to take steps to change very soon',
  'i_am_curious_about_changing': 'curious about changing but haven\'t taken steps yet',
  'i_am_not_interested_in_changing': 'not interested in changing',
  
  // Goals / Ideal outcome (pq-goal-alcohol screen)
  'drink_less': 'drink less',
  'quit_eventually': 'quit drinking eventually',
  'maintain_sobriety': 'maintain sobriety',
  'learn_explore': 'learn more and explore options',
  'explore': 'explore options',
  'track_consumption': 'track consumption and discover patterns',
  
  // Areas to improve (pq-areas-to-improve screen)
  'frequency': 'limiting drinking to specific days or times',
  'moderation': 'having fewer drinks per typical drinking day',
  'intensity': 'avoiding or eliminating heavy drinking',
  
  // Motivations (pq-motivation screen - multi-select)
  'physical_health': 'physical health',
  'emotional_stability': 'emotional stability',
  'relationships': 'relationships',
  'sleep_quality': 'sleep quality',
  'saving_money': 'saving money',
  'decision_making': 'decision-making',
  'self_confidence': 'self-confidence',
  'personal_growth': 'personal growth',
  'financial_stability': 'financial stability',
  'wellbeing': 'wellbeing',
  'incentive': 'earning incentives/gift cards',
  
  // Learning topics (pq-learning-topics screen - multi-select)
  'habits': 'building healthier habits',
  'cravings_support': 'managing cravings',
  'mindfulness': 'mindfulness techniques',
  'meditation': 'meditation practices',
  'diet_nutrition': 'diet and nutrition',
};

// Parse a user-spoken time string into UTC HH:MM format using browser timezone
function parseLocalTimeToUTC(timeStr: string): string {
  if (!timeStr || typeof timeStr !== 'string') return timeStr || '21:00'; // fallback to 9 PM UTC
  const normalized = timeStr.trim().toLowerCase();
  if (!normalized) return '21:00'; // fallback if empty after trim

  const vagueMap: Record<string, [number, number]> = {
    'morning': [9, 0], 'afternoon': [14, 0], 'evening': [18, 0],
    'night': [21, 0], 'noon': [12, 0], 'midday': [12, 0], 'midnight': [0, 0],
  };

  let localHours: number;
  let localMinutes: number;

  if (vagueMap[normalized]) {
    [localHours, localMinutes] = vagueMap[normalized];
  } else {
    const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
    if (!match) return timeStr;
    localHours = parseInt(match[1], 10);
    localMinutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3]?.replace(/\./g, '').toLowerCase();
    if (period === 'pm' && localHours < 12) localHours += 12;
    else if (period === 'am' && localHours === 12) localHours = 0;
  }

  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHours, localMinutes, 0);
  return `${String(localDate.getUTCHours()).padStart(2, '0')}:${String(localDate.getUTCMinutes()).padStart(2, '0')}`;
}

function normalizeAgentNameForRuntime(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, (char) => char.toLowerCase());
}

function formatRecordingDuration(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type PreviewRecordingNotice = {
  kind: 'error' | 'info' | 'success';
  message: string;
};

const RECORD_INPUT_DISPLAY_MS = 3000;
const RECENT_RECORD_INPUT_WINDOW_MS = 15000;
const PROMPT_TOOL_NAME_CANDIDATES = [
  'trigger_event',
  'navigate_to',
  'record_input',
  'set_goals',
  'capture_weekly_focus',
  'set_reminder_time',
  'set_checkin_frequency',
  'end_call',
  'navigate_to_screen',
  'switch_agent',
  'transfer_to_agent',
  'screen_out_participant',
];
const LIVE_AGENT_MESSAGE_MODULE_KEY = 'agentLiveMessage';
const MODULE_KEYS_ALLOW_EMPTY_OVERWRITE = new Set([
  LIVE_AGENT_MESSAGE_MODULE_KEY,
]);

function isEmptyModuleValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function mergeProgressiveText(previous: string, incoming: string): string {
  const prev = previous || '';
  const next = incoming || '';
  if (!next) return prev;
  if (!prev) return next;
  if (next === prev) return prev;
  if (next.startsWith(prev)) return next;
  if (prev.startsWith(next)) return prev;
  if (next.includes(prev)) return next;
  if (prev.includes(next)) return prev;

  const maxOverlap = Math.min(prev.length, next.length);
  for (let overlap = maxOverlap; overlap >= 4; overlap -= 1) {
    if (prev.slice(-overlap) === next.slice(0, overlap)) {
      return `${prev}${next.slice(overlap)}`;
    }
  }

  return next;
}

function textFromCharacterArray(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const text = value
    .map((entry) => (typeof entry === 'string' ? entry : String(entry ?? '')))
    .join('');
  return text.length > 0 ? text : null;
}

function extractAlignmentText(alignment: unknown): string | null {
  if (!alignment) return null;

  const queue: unknown[] = [alignment];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) continue;
    visited.add(current);

    const payload = current as Record<string, unknown>;
    const charactersText = textFromCharacterArray(payload.characters ?? payload.chars);
    if (charactersText !== null) {
      return charactersText;
    }
    if (typeof payload.text === 'string' && payload.text.length > 0) {
      return payload.text;
    }

    const nestedCandidates = [
      payload.alignment,
      payload.audio_alignment,
      payload.audioAlignment,
      payload.normalizedAlignment,
      payload.raw,
      payload.data,
    ];

    for (const nested of nestedCandidates) {
      if (nested && typeof nested === 'object' && !visited.has(nested)) {
        queue.push(nested);
      }
    }
  }

  return null;
}

type AgentScreenEvent = {
  id?: string;
  action?: Array<{ type?: string; deeplink?: string }>;
};

type AgentScreen = {
  id?: string;
  events?: AgentScreenEvent[];
  sections?: Array<{
    elements?: Array<{
      events?: AgentScreenEvent[];
    }>;
  }>;
};

function promptReferencesTool(prompt: string, toolName: string): boolean {
  const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const toolPattern = new RegExp(`\\b${escapedToolName}\\s*\\(`, 'i');
  return toolPattern.test(prompt);
}

function getPromptReferencedToolNames(prompt: string, candidates: string[]): string[] {
  if (!prompt || !candidates.length) return [];
  return candidates.filter((toolName) => promptReferencesTool(prompt, toolName));
}

function collectNavigationTargetsFromEvent(event: AgentScreenEvent | undefined): string[] {
  if (!event?.action || !Array.isArray(event.action)) return [];
  return event.action
    .filter((action) => action?.type === 'navigation' && typeof action?.deeplink === 'string')
    .map((action) => action.deeplink!.trim())
    .filter(Boolean);
}

function getScreenEvents(screen: AgentScreen | undefined): AgentScreenEvent[] {
  if (!screen) return [];
  const sectionEvents = (screen.sections || []).flatMap((section) =>
    (section?.elements || []).flatMap((element) => element?.events || [])
  );
  const allEvents = [...(screen.events || []), ...sectionEvents]
    .filter((event): event is AgentScreenEvent => Boolean(event) && typeof event.id === 'string');
  const dedupedById = new Map<string, AgentScreenEvent>();
  for (const event of allEvents) {
    if (event.id && !dedupedById.has(event.id)) {
      dedupedById.set(event.id, event);
    }
  }
  return Array.from(dedupedById.values());
}

function extractModuleDataKeyFromConditionRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutBraces =
    trimmed.startsWith('{') && trimmed.endsWith('}')
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  if (!withoutBraces.startsWith('$moduleData.')) return null;

  const key = withoutBraces.slice('$moduleData.'.length).trim();
  return key.length > 0 ? key : null;
}

function collectModuleDataKeysFromConditions(conditions: unknown, target: Set<string>) {
  if (!Array.isArray(conditions)) return;
  for (const condition of conditions) {
    if (!condition || typeof condition !== 'object') continue;
    const state = (condition as Record<string, unknown>).state;
    if (!state || typeof state !== 'object') continue;

    for (const value of Object.values(state as Record<string, unknown>)) {
      const key = extractModuleDataKeyFromConditionRef(value);
      if (key) {
        target.add(key);
      }
    }
  }
}

function getJourneyScreensForConditionScan(journey: Journey | null | undefined): AgentScreen[] {
  if (!journey || typeof journey !== 'object') return [];

  const journeyRecord = journey as unknown as Record<string, unknown>;
  const directScreens = Array.isArray(journeyRecord.screens)
    ? (journeyRecord.screens as AgentScreen[])
    : [];
  if (directScreens.length > 0) {
    return directScreens;
  }

  if (!Array.isArray(journey.agents)) return [];
  return journey.agents.flatMap((agent) =>
    Array.isArray((agent as any)?.screens) ? ((agent as any).screens as AgentScreen[]) : []
  );
}

function collectJourneyConditionalModuleKeys(journey: Journey | null | undefined): Set<string> {
  const keys = new Set<string>();
  const screens = getJourneyScreensForConditionScan(journey);

  for (const screen of screens) {
    if (!screen) continue;
    collectModuleDataKeysFromConditions((screen as any).conditions, keys);
    collectModuleDataKeysFromConditions((screen as any).eventConditions, keys);

    for (const event of getScreenEvents(screen)) {
      collectModuleDataKeysFromConditions((event as any)?.conditions, keys);
      const actions = Array.isArray((event as any)?.action) ? ((event as any).action as any[]) : [];
      for (const action of actions) {
        collectModuleDataKeysFromConditions(action?.conditions, keys);
      }
    }

    for (const section of (screen.sections || [])) {
      for (const element of (section?.elements || [])) {
        collectModuleDataKeysFromConditions((element as any)?.conditions, keys);
        const events = Array.isArray((element as any)?.events) ? ((element as any).events as any[]) : [];
        for (const event of events) {
          collectModuleDataKeysFromConditions(event?.conditions, keys);
          const actions = Array.isArray(event?.action) ? (event.action as any[]) : [];
          for (const action of actions) {
            collectModuleDataKeysFromConditions(action?.conditions, keys);
          }
        }
      }
    }
  }

  return keys;
}

function getReachableScreenIds(screens: AgentScreen[], startScreenId: string): string[] {
  const byId = new Map<string, AgentScreen>();
  for (const screen of screens || []) {
    if (screen?.id) byId.set(screen.id, screen);
  }

  if (!byId.has(startScreenId)) return [];

  const visited = new Set<string>();
  const queue: string[] = [startScreenId];
  const ordered: string[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    ordered.push(currentId);

    const current = byId.get(currentId);
    const nextIds = getScreenEvents(current)
      .flatMap((event) => collectNavigationTargetsFromEvent(event))
      .filter((id) => byId.has(id) && !visited.has(id));

    for (const nextId of nextIds) {
      queue.push(nextId);
    }
  }

  return ordered;
}

function hasEmbeddedScreenPromptSections(agentPrompt: string | undefined): boolean {
  const prompt = (agentPrompt || '').trim();
  if (!prompt) return false;
  return /^(?:##\s*)?SCREEN:\s*\S+/im.test(prompt) || /^#\s*Screen instructions/im.test(prompt);
}

function getPromptReferencedScreenIds(
  agentPrompt: string | undefined,
  availableScreenPromptIds: string[]
): Set<string> {
  const prompt = (agentPrompt || '').trim();
  if (!prompt || !availableScreenPromptIds.length) {
    return new Set<string>();
  }

  const referenced = new Set<string>();
  for (const screenId of availableScreenPromptIds) {
    const escapedId = screenId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionHeaderPattern = new RegExp(`^##\\s*${escapedId}(?:\\s|$)`, 'im');
    const screenSectionPattern = new RegExp(`^(?:##\\s*)?SCREEN:\\s*${escapedId}(?:\\s|$)`, 'im');
    const screenIdPattern = new RegExp(`Screen ID:\\s*${escapedId}(?:\\s|$)`, 'i');
    if (sectionHeaderPattern.test(prompt) || screenSectionPattern.test(prompt) || screenIdPattern.test(prompt)) {
      referenced.add(screenId);
    }
  }

  return referenced;
}

function buildScreenPromptsAppendix(params: {
  agentPrompt?: string;
  screenPrompts?: Record<string, string>;
  screens?: AgentScreen[];
  startScreenId?: string;
}): {
  text: string;
  includedScreenIds: string[];
  skippedBecauseEmbedded: boolean;
  appendedAsOverride: boolean;
} {
  const entries = Object.entries(params.screenPrompts || {})
    .filter(([screenId, prompt]) => Boolean(screenId) && typeof prompt === 'string' && prompt.trim().length > 0);
  if (entries.length === 0) {
    return { text: '', includedScreenIds: [], skippedBecauseEmbedded: false, appendedAsOverride: false };
  }

  const availableIds = entries.map(([screenId]) => screenId);
  const hasEmbeddedSections = hasEmbeddedScreenPromptSections(params.agentPrompt);
  const referencedIds = getPromptReferencedScreenIds(params.agentPrompt, availableIds);

  const entryMap = new Map(entries);
  let includedIds = availableIds;

  if (params.startScreenId && Array.isArray(params.screens) && params.screens.length > 0) {
    const reachableIds = getReachableScreenIds(params.screens, params.startScreenId)
      .filter((screenId) => entryMap.has(screenId));
    if (reachableIds.length > 0) {
      includedIds = reachableIds;
    }
  }

  // Never append sections that are already present in the prompt.
  if (referencedIds.size > 0) {
    includedIds = includedIds.filter((screenId) => !referencedIds.has(screenId));
  }
  if (includedIds.length === 0) {
    return {
      text: '',
      includedScreenIds: [],
      skippedBecauseEmbedded: hasEmbeddedSections,
      appendedAsOverride: false,
    };
  }

  const screenSectionsText = includedIds
    .map((screenId) => `\n## SCREEN: ${screenId}\n${entryMap.get(screenId)}`)
    .join('\n\n');
  if (hasEmbeddedSections) {
    // When the prompt already has embedded screen sections, append only missing screens
    // and avoid an "authoritative override" block that can conflict with existing rules.
    const appendixText = [
      '\n---',
      'RUNTIME SCREEN APPENDIX (MISSING SECTIONS)',
      'The screens below were not found in the base prompt.',
      '---',
      screenSectionsText,
    ].join('\n');
    return {
      text: appendixText,
      includedScreenIds: includedIds,
      skippedBecauseEmbedded: false,
      appendedAsOverride: false,
    };
  }

  return {
    text: screenSectionsText,
    includedScreenIds: includedIds,
    skippedBecauseEmbedded: false,
    appendedAsOverride: false,
  };
}

function normalizeRecordInputTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toCamelCaseKey(input: string): string {
  const parts = normalizeRecordInputTitle(input).split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join('');
}

function deriveRecordInputModuleUpdates(params: {
  title?: string;
  summary?: string;
  storeKey?: string;
}): Record<string, string> {
  const summary = typeof params.summary === 'string' ? params.summary.trim() : '';
  if (!summary) return {};

  const updates: Record<string, string> = {};
  const storeKey = typeof params.storeKey === 'string' ? params.storeKey.trim() : '';
  const normalizedTitle = normalizeRecordInputTitle(typeof params.title === 'string' ? params.title : '');

  const setUpdate = (key: string) => {
    if (key && !updates[key]) {
      updates[key] = summary;
    }
  };

  if (storeKey) {
    setUpdate(storeKey);
  }

  if (normalizedTitle) {
    const titleKey = toCamelCaseKey(normalizedTitle);
    if (titleKey) {
      setUpdate(titleKey);
      if (!titleKey.endsWith('Summary')) {
        setUpdate(`${titleKey}Summary`);
      }
    }
  }

  return updates;
}

function getTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isWeeklyFocusRecordInput(params: {
  title?: unknown;
  storeKey?: unknown;
}): boolean {
  const storeKey = getTrimmedString(params.storeKey);
  if (storeKey === 'weeklyFocus' || storeKey === 'weeklyIntention') {
    return true;
  }

  const normalizedTitle = normalizeRecordInputTitle(getTrimmedString(params.title));
  return (
    normalizedTitle === 'weekly focus' ||
    normalizedTitle === 'weekly intention' ||
    normalizedTitle === 'intention'
  );
}

function getStoredWeeklyFocusText(moduleState: Record<string, any> | null | undefined): string {
  const weeklyFocus = getTrimmedString(moduleState?.weeklyFocus);
  if (weeklyFocus) return weeklyFocus;
  return getTrimmedString(moduleState?.weeklyIntention);
}

function applyWeeklyFocusRecordInputPolicy(
  params: {
    title?: unknown;
    summary?: unknown;
    storeKey?: unknown;
  },
  updates: Record<string, string>,
  moduleState: Record<string, any> | null | undefined
): { summary: string; updates: Record<string, string> } {
  const inputSummary = getTrimmedString(params.summary);
  if (!isWeeklyFocusRecordInput(params)) {
    return { summary: inputSummary, updates };
  }

  // capture_weekly_focus is the source of truth for the member's exact wording.
  const preservedSummary = getStoredWeeklyFocusText(moduleState);
  const summary = preservedSummary || inputSummary;
  const sanitizedUpdates = { ...updates };

  // Never let record_input overwrite weekly-focus keys derived from title/storeKey.
  delete sanitizedUpdates.weeklyFocus;
  delete sanitizedUpdates.weeklyFocusSummary;
  delete sanitizedUpdates.weeklyIntentionSummary;

  if (preservedSummary) {
    // Keep existing member wording untouched once captured.
    delete sanitizedUpdates.weeklyIntention;
  } else if (summary && !sanitizedUpdates.weeklyIntention) {
    // Fallback when capture_weekly_focus was not called.
    sanitizedUpdates.weeklyIntention = summary;
  }

  return { summary, updates: sanitizedUpdates };
}

// Transform quiz module state option IDs to readable labels
// Handles both single-select strings and multi-select arrays/JSON strings
function transformQuizAnswersToLabels(moduleState: Record<string, any>): Record<string, any> {
  const transformed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(moduleState)) {
    // Skip non-quiz fields
    if (value === undefined || value === null) {
      continue;
    }
    
    let arrayValue: string[] | null = null;
    
    // Check if value is array or JSON array string
    if (Array.isArray(value)) {
      arrayValue = value;
    } else if (typeof value === 'string' && value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          arrayValue = parsed;
        }
      } catch {
        // Not valid JSON, treat as string
      }
    }
    
    if (arrayValue !== null) {
      // Multi-select: transform array of IDs to readable list
      const labels = arrayValue.map(id => {
        const label = QUIZ_OPTION_LABELS[id];
        if (!label && typeof id === 'string' && id.length > 0) {
          console.warn(`⚠️ Missing quiz label mapping for option ID: "${id}"`);
        }
        return label || id;
      });
      transformed[key] = labels.join(', ');
    } else if (typeof value === 'string' && QUIZ_OPTION_LABELS[value]) {
      // Single select: transform ID to label
      transformed[key] = QUIZ_OPTION_LABELS[value];
    } else {
      // Keep as-is (already readable or unknown)
      transformed[key] = value;
    }
  }
  
  console.log('🔄 transformQuizAnswersToLabels:', {
    inputKeys: Object.keys(moduleState),
    outputKeys: Object.keys(transformed),
    sampleOutput: Object.fromEntries(Object.entries(transformed).slice(0, 4)),
  });
  
  return transformed;
}

// Main Voice Agent Component
function VoiceAgentContent() {
  const {
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
    transcriptItems,
  } = useTranscript();
  const { logServerEvent, loggedEvents } = useEvent();
  const {
    triggerFunctionUI,
    triggerEventUI,
    enableScreenRendering,
    disableScreenRendering,
    navigateToScreen,
    moduleState,
    updateModuleState,
    replaceModuleState,
    setAgents,
    switchToAgent,
    flowContext,
    updateFlowContext,
    clearFlowContext,
    currentScreenId,
  } = useAgentUI();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const previewCaptureElementRef = useRef<HTMLDivElement | null>(null);
  const currentAgentRef = useRef<string>('greeter');
  const currentScreenIdRef = useRef<string | null>(null);
  const moduleStateRef = useRef<Record<string, any>>(moduleState || {});
  const ownedMicStreamRef = useRef<MediaStream | null>(null);
  const isDisconnectingRef = useRef(false);
  const audioPlaybackRafRef = useRef<number | null>(null);
  const agentSpeechPlaybackAnchorRef = useRef<number | null>(null);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  const personaAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return document.createElement('audio');
    const el = document.createElement('audio');
    el.autoplay = true;
    return el;
  }, []);

  const stopMediaStreamTracks = useCallback((stream: MediaStream | null | undefined, context: string) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      if (track.readyState !== 'ended') {
        track.stop();
      }
    });
    console.log(`🧹 Stopped media stream tracks (${context})`);
  }, []);

  const releaseOwnedMicStream = useCallback((reason: string) => {
    if (!ownedMicStreamRef.current) return;
    stopMediaStreamTracks(ownedMicStreamRef.current, `owned mic stream: ${reason}`);
    ownedMicStreamRef.current = null;
  }, [stopMediaStreamTracks]);

  const resetAudioElement = useCallback((audioElement: HTMLAudioElement | null | undefined, context: string) => {
    if (!audioElement) return;
    try {
      audioElement.pause();
    } catch (error) {
      console.warn(`Failed to pause ${context} audio element`, error);
    }
    const attachedStream = audioElement.srcObject;
    if (attachedStream instanceof MediaStream) {
      stopMediaStreamTracks(attachedStream, `${context} audio output`);
    }
    audioElement.srcObject = null;
    audioElement.removeAttribute('src');
    try {
      audioElement.load();
    } catch (error) {
      console.warn(`Failed to reset ${context} audio element`, error);
    }
  }, [stopMediaStreamTracks]);

  const syncAgentSpeechPlaybackClock = useCallback(() => {
    const audioElement = audioElementRef.current;
    if (!audioElement) return;
    const playbackMs = Math.max(0, audioElement.currentTime * 1000);
    setAgentSpeechPlaybackMs((previous) => {
      if (previous !== null && Math.abs(previous - playbackMs) < 10) {
        return previous;
      }
      return playbackMs;
    });
  }, []);

  const stopAgentSpeechPlaybackLoop = useCallback(() => {
    if (audioPlaybackRafRef.current !== null) {
      window.cancelAnimationFrame(audioPlaybackRafRef.current);
      audioPlaybackRafRef.current = null;
    }
  }, []);

  const startAgentSpeechPlaybackLoop = useCallback(() => {
    stopAgentSpeechPlaybackLoop();
    const tick = () => {
      syncAgentSpeechPlaybackClock();
      audioPlaybackRafRef.current = window.requestAnimationFrame(tick);
    };
    audioPlaybackRafRef.current = window.requestAnimationFrame(tick);
  }, [stopAgentSpeechPlaybackLoop, syncAgentSpeechPlaybackClock]);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
      
      // Track actual audio playback to control speaking state
      const handleAudioPlay = () => {
        console.log('🔊 Audio started playing');
        syncAgentSpeechPlaybackClock();
        startAgentSpeechPlaybackLoop();
        setActiveSpeaker('agent');
      };
      
      const handleAudioEnded = () => {
        console.log('🔇 Audio ended');
        syncAgentSpeechPlaybackClock();
        stopAgentSpeechPlaybackLoop();
        setActiveSpeaker('member');
      };
      
      const handleAudioPause = () => {
        syncAgentSpeechPlaybackClock();
        stopAgentSpeechPlaybackLoop();
        // Only set speaking to false if audio is actually paused (not just buffering)
        if (sdkAudioElement.ended) {
          console.log('⏸️ Audio paused/ended');
          setActiveSpeaker('member');
        }
      };

      const handleTimeUpdate = () => {
        syncAgentSpeechPlaybackClock();
      };
      
      sdkAudioElement.addEventListener('play', handleAudioPlay);
      sdkAudioElement.addEventListener('ended', handleAudioEnded);
      sdkAudioElement.addEventListener('pause', handleAudioPause);
      sdkAudioElement.addEventListener('timeupdate', handleTimeUpdate);
      sdkAudioElement.addEventListener('seeking', handleTimeUpdate);
      sdkAudioElement.addEventListener('seeked', handleTimeUpdate);
      
      return () => {
        stopAgentSpeechPlaybackLoop();
        sdkAudioElement.removeEventListener('play', handleAudioPlay);
        sdkAudioElement.removeEventListener('ended', handleAudioEnded);
        sdkAudioElement.removeEventListener('pause', handleAudioPause);
        sdkAudioElement.removeEventListener('timeupdate', handleTimeUpdate);
        sdkAudioElement.removeEventListener('seeking', handleTimeUpdate);
        sdkAudioElement.removeEventListener('seeked', handleTimeUpdate);
      };
    }
  }, [sdkAudioElement, startAgentSpeechPlaybackLoop, stopAgentSpeechPlaybackLoop, syncAgentSpeechPlaybackClock]);

  useEffect(() => {
    return () => {
      stopAgentSpeechPlaybackLoop();
      releaseOwnedMicStream('component unmount');
      resetAudioElement(audioElementRef.current, 'primary');
      resetAudioElement(personaAudioElement, 'persona');
      if (sdkAudioElement?.parentNode) {
        sdkAudioElement.parentNode.removeChild(sdkAudioElement);
      }
    };
  }, [personaAudioElement, releaseOwnedMicStream, resetAudioElement, sdkAudioElement, stopAgentSpeechPlaybackLoop]);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [_shape] = useState<'oval' | 'rectangle'>('oval');
  const [_substance] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [sessionLogs, setSessionLogs] = useState<LogEntry[]>([]);
  const sessionLogsRef = useRef<LogEntry[]>([]);
  const loggedEventsRef = useRef(loggedEvents);
  // Testing Persona state - OFF by default
  const [personaEnabled, setPersonaEnabled] = useState(() => {
    const saved = localStorage.getItem('voice-agent-persona-enabled');
    // Default to false (OFF) - only enable if explicitly saved as true
    return saved ? JSON.parse(saved) : false;
  });
  const [personaDescription, setPersonaDescription] = useState(() => {
    return localStorage.getItem('voice-agent-persona-description') || '';
  });
  const [pqData, setPQData] = useState<Partial<PQData>>(() => {
    const saved = localStorage.getItem('voice-agent-pq-data');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedVoice, setSelectedVoice] = useState(() => {
    return localStorage.getItem('voice-agent-selected-voice') || '';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [previewRecordingNotice, setPreviewRecordingNotice] = useState<PreviewRecordingNotice | null>(null);
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);
  const [availableJourneys, setAvailableJourneys] = useState<JourneyListItem[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(true);
  
  // Voice control state
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<ActiveSpeaker>('none');
  const [memberAudioLevel, setMemberAudioLevel] = useState(0);
  const [agentSpeechAlignment, setAgentSpeechAlignment] = useState<ElevenLabsAudioAlignmentSnapshot | null>(null);
  const [agentSpeechPlaybackMs, setAgentSpeechPlaybackMs] = useState<number | null>(null);
  const [agentSpeechPlaybackAnchorMs, setAgentSpeechPlaybackAnchorMs] = useState<number | null>(null);
  const [_hasScreensVisible, setHasScreensVisible] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  
  // Non-voice mode state
  const [isNonVoiceMode, setIsNonVoiceMode] = useState(false);
  
  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);
  
  // Microphone permission error state
  const [micPermissionError, setMicPermissionError] = useState(false);
  
  // Connection error state for displaying persistent error messages
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Journey transition state - prevents journeys list from showing during flow transitions
  const [isTransitioningJourney, setIsTransitioningJourney] = useState(false);
  
  // Loading state for when a journey is being loaded after user taps Start
  const [loadingJourneyId, setLoadingJourneyId] = useState<string | null>(null);
  
  // Ref to store current journey for event handlers (avoids closure issues)
  const currentJourneyRef = useRef<Journey | null>(null);
  
  // Keep currentScreenIdRef in sync with currentScreenId (avoids closure issues in event handlers)
  useEffect(() => {
    currentScreenIdRef.current = currentScreenId ?? null;
  }, [currentScreenId]);

  useEffect(() => {
    if (sessionStatus !== 'CONNECTED') {
      setShowVoiceHelp(false);
    }
  }, [sessionStatus]);

  // Keep a synchronous module-state ref so sequential tool calls can read latest values.
  useEffect(() => {
    moduleStateRef.current = moduleState || {};
  }, [moduleState]);

  
  // Notification permission popup state
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  
  // Preview mode state (when accessed via shared link with ?journey=X or ?flow=X)
  // Only enabled when there's a journey ID in the URL - base URL always shows flows page
  const [isPreviewMode] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlJourney = urlParams.get('journey') || urlParams.get('flow');
    
    // Clean up any stale localStorage flags
    if (!hasUrlJourney) {
      localStorage.removeItem('voice-agent-preview-mode');
      localStorage.removeItem('voice-agent-launch-journey');
    }
    
    // Only enable preview mode if URL has journey param
    return !!hasUrlJourney;
  });
  const [previewLoading, setPreviewLoading] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasUrlJourney = urlParams.get('journey') || urlParams.get('flow');
    
    // Only show loading if URL has journey param
    return !!hasUrlJourney;
  });
  
  // Session tracking for transcript export
  const sessionIdRef = useRef<string>(`session_${Date.now()}`);
  // Track the combined prompt sent to the agent for export
  const combinedPromptRef = useRef<string>('');
  // Ref to hold the latest connectToRealtime function (avoids stale closure in event handlers)
  const connectToRealtimeRef = useRef<((journeyOverride?: Journey, flowContextOverride?: Record<string, any>, options?: { skipScreenReset?: boolean }) => Promise<void>) | null>(null);

  // Ref for disconnectFromRealtime - needed for client tools that are registered at hook init time
  const disconnectFromRealtimeRef = useRef<((forceShowFeedback?: boolean) => Promise<void>) | null>(null);
  // Track Prolific outcome for proper redirect (completed vs screened_out)
  const prolificOutcomeRef = useRef<ProlificOutcome>('completed');
  // Tracks delayed navigation scheduled by runtime tools (record_input/navigate_to/capture_weekly_focus).
  const pendingNavigationRef = useRef<{
    eventId: string;
    executeAtMs: number;
    expiresAtMs: number;
    targetScreenId?: string;
    source?: 'record_input' | 'navigate_to' | 'capture_weekly_focus';
  } | null>(null);
  // Legacy queue for post-navigation events. Kept only for compatibility;
  // runtime now rejects cross-screen chaining instead of replaying queued events.
  const queuedPostNavigationEventRef = useRef<{
    eventId: string;
    targetScreenId: string;
    delaySeconds: number;
    queuedAtMs: number;
    expiresAtMs: number;
    sourceEventId: string;
  } | null>(null);
  const lastRecordInputRef = useRef<{
    atMs: number;
    title: string;
    summary: string;
  } | null>(null);
  // Safety fallback to prevent notification setup from getting stuck.
  const notificationPlanReviewFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Real-time session saver with debouncing
  const sessionSaverRef = useRef<DebouncedSessionSaver>(
    new DebouncedSessionSaver(500, (error) => {
      console.error('Real-time save error:', error);
    })
  );

  // Buffer for accumulating assistant responses
  const assistantResponseBuffer = useRef<string>('');
  const assistantResponseStartTime = useRef<Date | null>(null);
  const currentMessageIdsRef = useRef<{ user?: string; assistant?: string }>({});
  // Startup guard: require at least one completed user utterance before
  // allowing record_input-driven progression on the active screen.
  const userUtteranceCountRef = useRef<number>(0);
  const userUtterancesByScreenRef = useRef<Record<string, number>>({});
  // Tracks screens where the user has started speaking (first transcript chunk).
  // Unlike utterancesByScreen (incremented on completion), this is set immediately
  // when the first transcript arrives — avoiding the race where the AI calls
  // record_input while the user is mid-sentence.
  const userHasSpokenOnScreenRef = useRef<Set<string>>(new Set());
  // Track keys set by record_input so stale captured responses don't pre-populate
  // future sessions before the member explicitly answers again.
  const recordInputDerivedKeysRef = useRef<Set<string>>(new Set());
  const lastElevenLabsModeRef = useRef<'speaking' | 'listening' | null>(null);
  const lastLiveAgentMessageRef = useRef<string | null>(null);
  const shouldResetLiveAgentMessageOnNextAssistantTextRef = useRef(false);
  const alignmentReceivedForTurnRef = useRef(false);
  const pendingTranscriptTextRef = useRef<string | null>(null);
  const didInitializeLiveAgentMessageRef = useRef(false);
  // Track which itemIds have been queued to prevent duplicate saves
  const queuedItemIdsRef = useRef<Set<string>>(new Set());
  // Buffer for accumulating user message text (since text comes in chunks)
  const userMessageBuffer = useRef<string>('');

  const { startRecording, stopRecording } = useAudioDownload();

  // Streaming recording - uploads to server in real-time
  const {
    startRecording: startStreamingRecording,
    stopRecording: stopStreamingRecording,
  } = useStreamingRecording({
    chunkDuration: 5000, // 5 second chunks
    onChunkUploaded: (chunkIndex) => {
      console.log(`📤 Chunk ${chunkIndex + 1} uploaded to storage`);
    },
    onError: (error) => {
      addLog('warning', `Recording upload error: ${error.message}`);
    },
  });

  const {
    status: previewRecordingStatus,
    isRecording: isPreviewRecording,
    elapsedMs: previewRecordingElapsedMs,
    error: previewRecordingError,
    recordingUrl: previewRecordingUrl,
    startRecording: startPreviewRecording,
    stopRecording: stopPreviewRecording,
    downloadRecording: downloadPreviewRecording,
    clearRecording: clearPreviewRecording,
  } = usePreviewFlowRecording();

  loggedEventsRef.current = loggedEvents;

  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      type,
      message,
      details
    };
    sessionLogsRef.current = [...sessionLogsRef.current, logEntry];
    setSessionLogs(prev => [...prev, logEntry]);
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 
                 type === 'agent' ? '🤖' : type === 'tool' ? '🔧' : type === 'event' ? '📢' : 'ℹ️';
    console.log(`${icon} [${type.toUpperCase()}] ${message}`, details || '');
  };

  const applyModuleStateUpdates = useCallback((updates: Record<string, any>) => {
    if (!updateModuleState || Object.keys(updates).length === 0) {
      return;
    }

    const sanitizedUpdates: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      const existingValue = moduleStateRef.current?.[key];
      const hasPersistedValue = !isEmptyModuleValue(existingValue);
      const incomingIsEmpty = isEmptyModuleValue(value);
      const allowEmptyOverwrite = MODULE_KEYS_ALLOW_EMPTY_OVERWRITE.has(key);

      if (incomingIsEmpty && hasPersistedValue && !allowEmptyOverwrite) {
        continue;
      }
      sanitizedUpdates[key] = value;
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return;
    }

    moduleStateRef.current = { ...moduleStateRef.current, ...sanitizedUpdates };
    updateModuleState(sanitizedUpdates);
  }, [updateModuleState]);

  const markCapturedModuleKeys = useCallback((updates: Record<string, any>) => {
    const keys = Object.keys(updates || {}).filter((key) => key.trim().length > 0);
    if (keys.length === 0) return;
    for (const key of keys) {
      recordInputDerivedKeysRef.current.add(key);
    }
  }, []);

  const sanitizeSessionFlowContext = useCallback((context: Record<string, any> | null | undefined) => {
    if (!context || typeof context !== 'object') return {};
    const blocked = recordInputDerivedKeysRef.current;
    return Object.fromEntries(
      Object.entries(context).filter(([key]) => {
        if (blocked.has(key)) return false;
        if (key.startsWith('recordedInput')) return false;
        if (key === LIVE_AGENT_MESSAGE_MODULE_KEY) return false;
        if (key === 'agentIsSpeaking' || key === 'agentSpeechMode') return false;
        return true;
      })
    );
  }, []);

  const normalizeFlowScreenContext = useCallback((context: Record<string, any>) => {
    const normalized = { ...(context || {}) };
    const camel = typeof normalized.currentScreen === 'string' ? normalized.currentScreen.trim() : '';
    const snake = typeof normalized.current_screen === 'string' ? normalized.current_screen.trim() : '';
    const resolved = camel || snake;

    if (resolved) {
      normalized.currentScreen = resolved;
      normalized.current_screen = resolved;
    }

    return normalized;
  }, []);

  const stripSpeechDirectives = useCallback((text: string): string => {
    return text
      .replace(/\[(?:slow|fast|pause|break|whisper|loud|soft|neutral|happy|sad|excited|calm|serious|cheerful|empathetic|curious|surprised|concerned|warm|gentle|firm|playful)\]/gi, '')
      .replace(/\b(?:Wait for (?:user |the user(?:'s)? |member(?:'s)? )?response\.?|Do not respond yet\.?|Wait for (?:their |the )?(?:reply|answer|input)\.?)\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }, []);

  const updateLiveAgentMessage = useCallback((message: string) => {
    const cleaned = stripSpeechDirectives(typeof message === 'string' ? message : '');
    if (
      lastLiveAgentMessageRef.current === cleaned &&
      moduleStateRef.current?.[LIVE_AGENT_MESSAGE_MODULE_KEY] === cleaned
    ) {
      return;
    }

    lastLiveAgentMessageRef.current = cleaned;
    applyModuleStateUpdates({ [LIVE_AGENT_MESSAGE_MODULE_KEY]: cleaned });
  }, [applyModuleStateUpdates, stripSpeechDirectives]);

  const clearLiveAgentMessage = useCallback(() => {
    shouldResetLiveAgentMessageOnNextAssistantTextRef.current = false;
    updateLiveAgentMessage('');
  }, [updateLiveAgentMessage]);

  const updateLiveAgentMessageProgressively = useCallback((incomingMessage: string) => {
    const rawMessage = typeof incomingMessage === 'string' ? incomingMessage : '';
    const trimmedMessage = rawMessage.trim();
    if (!trimmedMessage) return;

    const shouldReset = shouldResetLiveAgentMessageOnNextAssistantTextRef.current;
    const previousMessage = shouldReset ? '' : (lastLiveAgentMessageRef.current ?? '');
    const mergedMessage = mergeProgressiveText(previousMessage, rawMessage);

    shouldResetLiveAgentMessageOnNextAssistantTextRef.current = false;
    updateLiveAgentMessage(mergedMessage);
  }, [updateLiveAgentMessage]);

  useEffect(() => {
    // Ensure interpolation references never render literal {$moduleData.*} placeholders.
    // Guard against callback identity changes triggering repeated clears mid-turn.
    if (didInitializeLiveAgentMessageRef.current) return;
    didInitializeLiveAgentMessageRef.current = true;
    clearLiveAgentMessage();
  }, [clearLiveAgentMessage]);

  // Prevent stale agent text from flashing when a navigation changes screens.
  useEffect(() => {
    if (!currentScreenId) return;
    clearLiveAgentMessage();
  }, [currentScreenId, clearLiveAgentMessage]);

  const clearNotificationPlanReviewFallback = useCallback(() => {
    if (notificationPlanReviewFallbackTimerRef.current) {
      clearTimeout(notificationPlanReviewFallbackTimerRef.current);
      notificationPlanReviewFallbackTimerRef.current = null;
    }
  }, []);

  const scheduleNotificationPlanReviewFallback = useCallback((_source: string) => {
    // Disabled: plan review should only be reached after an explicit user response
    // on notification setup (allow/deny), not via silent timeout.
    clearNotificationPlanReviewFallback();
  }, [clearNotificationPlanReviewFallback]);

  const resetToFlowsScreen = () => {
    clearNotificationPlanReviewFallback();
    pendingNavigationRef.current = null;
    queuedPostNavigationEventRef.current = null;
    lastRecordInputRef.current = null;
    clearFlowContext?.();
    clearLiveAgentMessage();
    setSessionStatus('DISCONNECTED');
    setActiveSpeaker('none');
    setMemberAudioLevel(0);
    setCurrentJourney(null);
    setIsTransitioningJourney(false);
    setLoadingJourneyId(null);
    setPreviewLoading(false);
    setIsNonVoiceMode(false);
    setHasScreensVisible(false);
    disableScreenRendering?.();
  };

  useEffect(() => {
    const handleResetToFlows = () => {
      resetToFlowsScreen();
    };
    window.addEventListener('resetToFlows', handleResetToFlows);
    return () => {
      window.removeEventListener('resetToFlows', handleResetToFlows);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearNotificationPlanReviewFallback();
    };
  }, [clearNotificationPlanReviewFallback]);

  // Load default journeys on first mount
  useEffect(() => {
    const loadJourneys = async () => {
      setJourneysLoading(true);
      try {
        // Refresh journey list on mount - uses production flows in production mode
        const journeyList = await listJourneysForRuntime();
        console.log('📋 Available journeys on mount:', journeyList.map(j => `${j.name} (${j.id})`));
        setAvailableJourneys(journeyList);
        
        // Check URL params for journey ID (for Prolific/external links)
        // Supports: ?journey=ID or ?flow=ID
        const urlParams = new URLSearchParams(window.location.search);
        const urlJourneyId = urlParams.get('journey') || urlParams.get('flow');

        // Clean up any stale localStorage flags - base URL should always show flows page
        localStorage.removeItem('voice-agent-launch-journey');
        localStorage.removeItem('voice-agent-preview-mode');

        // Only auto-launch journeys from URL params (not localStorage)
        // This ensures base URL always shows the flows page
        if (urlJourneyId) {
          const journeyToLaunch = await loadJourneyForRuntime(urlJourneyId);
          if (journeyToLaunch) {
            setCurrentJourney(journeyToLaunch);
            setPreviewLoading(false); // Journey loaded, hide loading overlay
            addLog('info', `🚀 Launching journey: ${journeyToLaunch.name} (from URL)`);
            
            // Check if this is a voice-enabled journey or non-voice
            const isVoiceJourney = journeyToLaunch.voiceEnabled !== false;
            console.log('🚀 Auto-launch journey check:', {
              name: journeyToLaunch.name,
              voiceEnabled: journeyToLaunch.voiceEnabled,
              isVoiceJourney,
            });
            
            // Auto-start after a brief delay
            setTimeout(() => {
              if (isVoiceJourney) {
                // Voice journey - connect to realtime immediately
                connectToRealtime(journeyToLaunch);
              } else {
                // Non-voice journey - start in button-based mode
                // Voice will be enabled later via enable_voice tool
                console.log('🔇 Starting non-voice session for:', journeyToLaunch.name);
                startNonVoiceSession(journeyToLaunch);
              }
            }, 500);
            return;
          }
        }
        // If no journey to launch, clear preview loading anyway
        setPreviewLoading(false);

        if (!currentJourney && journeyList.length > 0) {
          // Auto-load first journey but don't start it
          const firstJourney = await loadJourneyForRuntime(journeyList[0].id);
          if (firstJourney) {
            setCurrentJourney(firstJourney);
            addLog('info', `📋 Journey ready: ${firstJourney.name}`);
          }
        }
      } catch (error) {
        console.error('Error loading journeys:', error);
        addLog('error', `Failed to load journeys: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setJourneysLoading(false);
        setPreviewLoading(false); // Always clear preview loading on completion
      }
    };

    loadJourneys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Capture Prolific parameters if this is an external research journey
  useEffect(() => {
    if (currentJourney?.research?.isExternal && currentJourney?.research?.prolific?.enabled) {
      // Check if we have Prolific params in the URL
      if (hasProlificParams()) {
        const params = captureProlificParams();
        storeProlificSession(currentJourney.id, params);
        console.log('📊 [Prolific] Session captured for journey:', currentJourney.name, params);
        addLog('info', `📊 Prolific participant detected: ${params.prolificPid?.substring(0, 8)}...`);
      }
    }
  }, [currentJourney?.id, currentJourney?.research?.isExternal, currentJourney?.research?.prolific?.enabled]);

  // Refresh journey when page becomes visible (e.g., returning from Journey Builder)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && sessionStatus === 'DISCONNECTED' && currentJourney) {
        console.log('🔄 Page visible, refreshing current journey...');
        try {
          const refreshedJourney = await loadJourneyForRuntime(currentJourney.id);
          if (refreshedJourney) {
            setCurrentJourney(refreshedJourney);
            console.log('✅ Journey refreshed:', refreshedJourney.name);
          }
          // Also refresh journey list
          const journeyList = await listJourneysForRuntime();
          setAvailableJourneys(journeyList);
        } catch (error) {
          console.error('Failed to refresh journey:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionStatus, currentJourney?.id]);

  // Listen for journey updates from Journey Builder (cross-tab communication)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    
    try {
      channel = new BroadcastChannel('journey-updates');
      
      channel.onmessage = async (event) => {
        const { type, journeyId, timestamp } = event.data;
        
        if (type === 'journey-saved') {
          console.log('📢 Received journey update broadcast:', journeyId, 'at', new Date(timestamp).toISOString());
          
          // Refresh the journey list
          try {
            const journeyList = await listJourneysForRuntime();
            setAvailableJourneys(journeyList);
            console.log('✅ Journey list refreshed');
            
            // If this is the currently loaded journey, refresh it too
            if (currentJourney?.id === journeyId) {
              const refreshedJourney = await loadJourneyForRuntime(journeyId);
              if (refreshedJourney) {
                setCurrentJourney(refreshedJourney);
                console.log('✅ Current journey refreshed:', refreshedJourney.name);
                addLog('info', `🔄 Journey updated: ${refreshedJourney.name}`);
              }
            }
          } catch (error) {
            console.error('Failed to refresh after journey update:', error);
          }
        }
      };
      
      console.log('📡 Listening for journey updates via BroadcastChannel');
    } catch (e) {
      console.warn('BroadcastChannel not supported');
    }
    
    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [currentJourney?.id, addLog]);

  // Start a non-voice session (no microphone, no WebRTC)
  const startNonVoiceSession = useCallback(async (journey: Journey) => {
    console.log('🚀 Starting non-voice session for journey:', journey.name);
    addLog('info', `🔇 Starting non-voice session: ${journey.name}`);
    clearLiveAgentMessage();

    // ALWAYS fetch fresh journey data from database to get latest screen edits
    let journeyToUse = journey;
    if (journey.id) {
      console.log('🔄 Fetching fresh journey data for non-voice session...');
      try {
        const freshJourney = await loadJourneyForRuntime(journey.id);
        if (freshJourney) {
          journeyToUse = freshJourney;
          console.log('✅ Fresh journey loaded:', freshJourney.name);
          setCurrentJourney(freshJourney);
          currentJourneyRef.current = freshJourney;
        }
      } catch (err) {
        console.warn('⚠️ Failed to fetch fresh journey, using cached version:', err);
      }
    }

    // Generate new session ID
    sessionIdRef.current = `session_${Date.now()}`;
    
    // Reset session state
    sessionSaverRef.current.reset();
    queuedItemIdsRef.current.clear();
    sessionLogsRef.current = [];
    setSessionLogs([]);

    // Store all agents for non-voice navigation
    if (setAgents) {
      setAgents(journeyToUse.agents);
    }

    // Find starting agent
    const startingAgentConfig = journeyToUse.agents.find(a => a.id === journeyToUse.startingAgentId);
    if (!startingAgentConfig) {
      addLog('error', 'Starting agent not found in journey');
      return;
    }

    const startingAgentName = startingAgentConfig.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
    currentAgentRef.current = startingAgentName;

    // Enable screen rendering with starting agent's screens
    if (startingAgentConfig.screens && startingAgentConfig.screens.length > 0) {
      addLog('info', `📱 Showing first screen: ${startingAgentConfig.screens[0].id}`);
      enableScreenRendering?.(startingAgentConfig.screens, startingAgentConfig.screens[0].id);
      setHasScreensVisible(true);
    } else {
      addLog('warning', '⚠️ Starting agent has no screens configured');
    }

    // Set session status to connected (non-voice active)
    setSessionStatus('CONNECTED');
    setActiveSpeaker('none');
    setMemberAudioLevel(0);
    setLoadingJourneyId(null);
    setIsNonVoiceMode(true);
    addLog('success', `✅ Non-voice session started`);
  }, [addLog, clearLiveAgentMessage, enableScreenRendering, setAgents]);

  // Listen for toolCallAction events (from ScreenContext) for navigate_to_agent
  useEffect(() => {
    console.log('🔌🔌🔌 VoiceAgent: Setting up toolCallAction listener 🔌🔌🔌');
    console.log('🔌 currentJourney:', currentJourney?.name);
    console.log('🔌 currentJourneyRef.current:', currentJourneyRef.current?.name);
    
    const handleToolCallAction = (event: Event) => {
      console.log('🔧🔧🔧 VoiceAgent received toolCallAction event! 🔧🔧🔧');
      const customEvent = event as CustomEvent;
      const { tool, params } = customEvent.detail;
      
      console.log('🔧 Tool:', tool, 'Params:', params);
      
      if (tool === 'navigate_to_agent' && params.agentId) {
        addLog('info', `🔄 Navigating to agent: ${params.agentId}`);
        if (switchToAgent) {
          switchToAgent(params.agentId);
        }
      }
      
      if (tool === 'end_session' || tool === 'complete_quiz') {
        addLog('info', `📞 Session complete`);
        // For non-voice mode, just disconnect (no feedback form needed)
        setSessionStatus('DISCONNECTED');
        setActiveSpeaker('none');
        setMemberAudioLevel(0);
        setIsNonVoiceMode(false);
        disableScreenRendering?.();
        setHasScreensVisible(false);
      }
      
      // Handle start_journey tool - load and start a new journey with flow context
      if (tool === 'start_journey' && params.journeyId) {
        console.log('🔗🔗🔗 START_JOURNEY TRIGGERED 🔗🔗🔗');
        console.log('🔗 journeyId:', params.journeyId);
        console.log('🔗 current sessionStatus:', sessionStatus);
        addLog('info', `🔗 Starting linked journey: ${params.journeyId}`);
        
        // Set transitioning flag to prevent journeys list from showing
        setIsTransitioningJourney(true);
        console.log('🔗 Set isTransitioningJourney to true');
        
        // Synchronously merge current moduleState with flowContext for data passing
        // This ensures all quiz answers are available to the next journey
        const mergedFlowContext = {
          ...sanitizeSessionFlowContext(flowContext || {}),
          ...sanitizeSessionFlowContext(moduleState || {}),
        };
        
        console.log('🔗 Merged flow context:', mergedFlowContext);
        
        // Also update the flowContext state for future use
        if (updateFlowContext && moduleState) {
          updateFlowContext(sanitizeSessionFlowContext(moduleState));
        }
        
        addLog('info', `🔗 Merged flow context keys: ${Object.keys(mergedFlowContext).join(', ')}`);
        
        // Load and start the target journey with merged context
        const loadAndStartJourney = async () => {
          try {
            console.log('🔗 Fetching journey from API...');
            // Try authenticated endpoint first, fall back to public preview endpoint
            let response = await fetch(`/api/journeys/${params.journeyId}`, {
              credentials: 'include', // Include cookies for authentication
            });
            
            // If auth fails, try the public preview endpoint
            if (response.status === 401) {
              console.log('🔗 Auth failed, trying preview endpoint...');
              response = await fetch(`/api/journeys/preview/${params.journeyId}`);
            }
            
            if (!response.ok) {
              throw new Error(`Failed to load journey: ${response.status} ${response.statusText}`);
            }
            const targetJourney = await response.json();
            console.log('🔗 Loaded journey:', targetJourney.name, 'voiceEnabled:', targetJourney.voiceEnabled);
            addLog('success', `📥 Loaded journey: ${targetJourney.name}`);
            
            // Exit non-voice mode since we're starting a voice journey
            setIsNonVoiceMode(false);
            
            // Set the new journey
            setCurrentJourney(targetJourney);
            
            // Set all agents for the new journey (for multi-agent navigation)
            if (setAgents) {
              setAgents(targetJourney.agents);
            }
            
            // IMMEDIATELY update screens to show the new journey's first screen
            // This provides visual feedback during the voice connection setup
            const startingAgentConfig = targetJourney.agents?.find(
              (a: any) => a.id === targetJourney.startingAgentId
            );
            
            if (startingAgentConfig?.screens && startingAgentConfig.screens.length > 0) {
              console.log('🔗 Immediately showing new journey screens:', startingAgentConfig.screens[0].id);
              enableScreenRendering?.(startingAgentConfig.screens, startingAgentConfig.screens[0].id);
              setHasScreensVisible(true);
            }
            
            // Force session to disconnected state first
            setSessionStatus('DISCONNECTED');
            setActiveSpeaker('none');
            setMemberAudioLevel(0);
            
            // Connect to voice session with the new journey
            console.log('🔗 About to schedule connectToRealtime call...');
            requestAnimationFrame(() => {
              setTimeout(() => {
                console.log('🔗 Calling connectToRealtimeRef.current');
                if (connectToRealtimeRef.current) {
                  connectToRealtimeRef.current(targetJourney, mergedFlowContext);
                } else {
                  console.error('🔗 connectToRealtimeRef.current is null!');
                }
              }, 100);
            });
          } catch (error) {
            console.error('🔗 Failed to start journey:', error);
            addLog('error', `Failed to start journey: ${error}`);
            resetToFlowsScreen();
          }
        };
        
        loadAndStartJourney();
        return; // Prevent other handlers from running
      }
      
      // NOTE: enable_voice is now handled via direct callback (handleEnableVoice) passed through
      // AgentUIRenderer -> ScreenProvider to preserve user gesture context for mic permission.
      // The window event approach loses gesture context, preventing mic permission prompts.
      if (tool === 'enable_voice') {
        console.log('🎤 enable_voice event received via window (fallback path)');
        // This should not be called anymore with the direct callback in place
        // If we get here, the callback wasn't wired up properly
        console.warn('🎤 Warning: enable_voice received via event - this loses user gesture context!');
        return;
      }
    };
    
    window.addEventListener('toolCallAction', handleToolCallAction as EventListener);
    
    return () => {
      window.removeEventListener('toolCallAction', handleToolCallAction as EventListener);
    };
  }, [addLog, switchToAgent, disableScreenRendering, enableScreenRendering, setAgents, flowContext, moduleState, updateFlowContext, currentJourney]);

  // Listen for navigation events from ScreenContext for debugging
  useEffect(() => {
    const handleEventTriggered = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventId, currentScreen, screensCount, eventData } = customEvent.detail;
      addLog('event', `🔘 Button/Event: "${eventId}" on screen "${currentScreen}"`, {
        screensCount,
        eventData,
      });
    };
    
    const handleNavigation = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { fromScreen, toScreen, deeplink, screensAvailable, screenIds } = customEvent.detail;
      addLog('info', `🧭 Navigation: "${fromScreen}" → "${toScreen}"`, {
        deeplink,
        screensAvailable,
        screenIds: screenIds?.slice(0, 5), // First 5 for brevity
      });
    };
    
    const handleNavigationResult = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { success, fromScreen, toScreen, availableScreens } = customEvent.detail;
      if (success) {
        if (toScreen) {
          // Keep tool-time screen guards in sync immediately before React state propagation.
          currentScreenIdRef.current = toScreen;
        }
        pendingNavigationRef.current = null;
        if (toScreen) {
          clearNotificationPlanReviewFallback();
        }
        if (toScreen) {
          const screenPointerUpdates = {
            currentScreen: toScreen,
            current_screen: toScreen,
          };
          applyModuleStateUpdates(screenPointerUpdates);
          updateFlowContext?.(screenPointerUpdates);
        }
        addLog('success', `✅ Navigated: "${fromScreen}" → "${toScreen}"`);
        // CRITICAL FIX: Sync the navigation result back to AgentUIContext
        // This ensures currentScreenIdRef stays in sync with ScreenContext's navigation
        if (navigateToScreen && toScreen) {
          navigateToScreen(toScreen);
        }

        const queuedPostNavigationEvent = queuedPostNavigationEventRef.current;
        if (queuedPostNavigationEvent) {
          addLog(
            'info',
            `↪️ Clearing queued event "${queuedPostNavigationEvent.eventId}" after navigation completion.`
          );
          queuedPostNavigationEventRef.current = null;
        }
      } else {
        addLog('error', `❌ Navigation failed: screen "${toScreen}" not found`, {
          fromScreen,
          availableScreens,
        });
      }
    };
    
    window.addEventListener('eventTriggered', handleEventTriggered as EventListener);
    window.addEventListener('screenNavigation', handleNavigation as EventListener);
    window.addEventListener('screenNavigationResult', handleNavigationResult as EventListener);
    
    return () => {
      window.removeEventListener('eventTriggered', handleEventTriggered as EventListener);
      window.removeEventListener('screenNavigation', handleNavigation as EventListener);
      window.removeEventListener('screenNavigationResult', handleNavigationResult as EventListener);
    };
  }, [addLog, applyModuleStateUpdates, clearNotificationPlanReviewFallback, navigateToScreen, updateFlowContext]);

  // Listen for tool-dispatched events and connect them to screen context functions
  // This bridges the gap between ElevenLabs client tool calls and UI navigation
  useEffect(() => {
    const handleTriggerEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventId } = customEvent.detail;
      const receivedAtMs = Date.now();
      console.log('🔧 [TOOL->UI] triggerEvent received:', eventId);
      addLog('tool', `🔧 Tool triggered event: ${eventId}`, {
        currentScreen: currentScreenIdRef.current,
        eventTimestamp: customEvent.detail?.timestamp ?? null,
        receivedAtMs,
      });
      
      // Special handling for permissions_screen_event - show notification permission popup
      if (eventId === 'permissions_screen_event') {
        addLog('info', '🔔 Notification permission request triggered - showing popup');
        setShowNotificationPopup(true);
        scheduleNotificationPlanReviewFallback('permissions_screen_event');
        return;
      }
      
      // Use triggerEventUI from context to actually trigger the event
      if (triggerEventUI) {
        triggerEventUI(eventId);
      }
    };
    
    const handleNavigateToScreen = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { screenId } = customEvent.detail;
      const receivedAtMs = Date.now();
      console.log('🔧 [TOOL->UI] navigateToScreen received:', screenId);
      addLog('tool', `🔧 Tool navigating to screen: ${screenId}`, {
        currentScreen: currentScreenIdRef.current,
        eventTimestamp: customEvent.detail?.timestamp ?? null,
        receivedAtMs,
      });
      
      // Use navigateToScreen from context to actually navigate
      if (navigateToScreen) {
        navigateToScreen(screenId);
      }
    };
    
    const handleRecordInput = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { title, summary, storeKey } = customEvent.detail;
      const receivedAtMs = Date.now();
      console.log('🔧 [TOOL->UI] recordInput received:', { title, summary, storeKey });
      addLog('tool', `🔧 Tool recorded: ${title} = "${summary?.substring(0, 50)}..."`, {
        currentScreen: currentScreenIdRef.current,
        eventTimestamp: customEvent.detail?.timestamp ?? null,
        receivedAtMs,
        storeKey: storeKey ?? null,
      });
    };
    
    window.addEventListener('triggerEvent', handleTriggerEvent as EventListener);
    window.addEventListener('navigateToScreen', handleNavigateToScreen as EventListener);
    window.addEventListener('recordInput', handleRecordInput as EventListener);
    
    return () => {
      window.removeEventListener('triggerEvent', handleTriggerEvent as EventListener);
      window.removeEventListener('navigateToScreen', handleNavigateToScreen as EventListener);
      window.removeEventListener('recordInput', handleRecordInput as EventListener);
    };
  }, [addLog, triggerEventUI, navigateToScreen, scheduleNotificationPlanReviewFallback]);

  const connectToRealtime = async (journeyOverride?: Journey, flowContextOverride?: Record<string, any>, options?: { skipScreenReset?: boolean }) => {
    console.log('🎙️🎙️🎙️ connectToRealtime CALLED 🎙️🎙️🎙️');
    console.log('🎙️ Arguments:', {
      journeyOverride: journeyOverride?.name,
      flowContextOverrideKeys: flowContextOverride ? Object.keys(flowContextOverride) : null,
      options,
    });
    console.log('🎙️ Current state:', {
      sessionStatus,
      isNonVoiceMode,
      currentJourney: currentJourney?.name,
    });
    
    // When called with journeyOverride (from start_journey or enable_voice), skip the session status check
    // because we just set it to DISCONNECTED but the closure has the old value
    if (!journeyOverride && sessionStatus !== "DISCONNECTED") {
      console.log('🎙️ EARLY EXIT: sessionStatus is not DISCONNECTED and no journeyOverride');
      addLog('warning', 'Session not disconnected - cannot connect');
      return;
    }

    // Get initial journey reference (before any async work)
    let journeyToUse = journeyOverride || currentJourney;

    // Check if we have a journey to run (early check before async work)
    if (!journeyToUse) {
      console.log('🎙️ EARLY EXIT: No journey to use');
      addLog('error', 'No journey selected. Please load or create a journey first.');
      return;
    }

    // Check if this is a non-voice journey (voiceEnabled is explicitly false)
    const isVoiceEnabled = journeyToUse.voiceEnabled !== false;
    console.log('🔊 Journey voiceEnabled check:', {
      voiceEnabled: journeyToUse.voiceEnabled,
      isVoiceEnabled,
      typeofVoiceEnabled: typeof journeyToUse.voiceEnabled,
    });

    if (!isVoiceEnabled) {
      console.log('🔇 EARLY EXIT: Starting non-voice session instead');
      addLog('info', '🔇 Non-voice journey detected');
      startNonVoiceSession(journeyToUse);
      return;
    }

    clearLiveAgentMessage();

    // CRITICAL: Request microphone permission FIRST, before any async work
    // This preserves the user gesture context needed for mic permission prompts
    // Both Azure and ElevenLabs need this - the SDK's internal request happens too late
    let microphoneStream: MediaStream | undefined;

    console.log('🎤 Requesting microphone permission EARLY (preserves user gesture)...');
    addLog('info', '🎤 Requesting microphone permission...');
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      console.log('🎤 Microphone permission GRANTED');
      addLog('success', '🎤 Microphone permission granted');
      ownedMicStreamRef.current = microphoneStream;
      setMicStream(microphoneStream);
    } catch (error) {
      console.error('🎤 MICROPHONE PERMISSION DENIED:', error);
      setMicPermissionError(true);
      addLog('error', `Microphone access denied: ${error}`);
      resetToFlowsScreen();
      return;
    }

    // NOW we can do async work - mic permission is secured
    // Fetch fresh journey data from database to get latest screen edits
    if (journeyToUse?.id) {
      console.log('🔄 Fetching fresh journey data from database...');
      try {
        const freshJourney = await loadJourneyForRuntime(journeyToUse.id);
        if (freshJourney) {
          journeyToUse = { ...freshJourney, voiceEnabled: journeyToUse.voiceEnabled };
          console.log('✅ Fresh journey loaded:', freshJourney.name);
          // Update state and ref with fresh data
          setCurrentJourney(freshJourney);
          currentJourneyRef.current = freshJourney;
        }
      } catch (err) {
        console.warn('⚠️ Failed to fetch fresh journey, using cached version:', err);
      }
    }
    console.log('🎙️ Using journey:', journeyToUse?.name, 'voiceEnabled:', journeyToUse?.voiceEnabled);

    // Generate new session ID for this session
    sessionIdRef.current = `session_${Date.now()}`;
    pendingNavigationRef.current = null;
    queuedPostNavigationEventRef.current = null;
    lastRecordInputRef.current = null;
    
    // Store session info on window for end_call tool access
    (window as any).__voiceSessionId = sessionIdRef.current;
    (window as any).__voiceJourneyName = journeyToUse.name;
    
    // Reset the real-time saver for the new session
    sessionSaverRef.current.reset();
    // Clear the queued item IDs set for the new session
    queuedItemIdsRef.current.clear();
    // Clear message buffers
    userMessageBuffer.current = '';
    assistantResponseBuffer.current = '';

    console.log('🚀 connectToRealtime called with journey:', journeyToUse.name, 'ID:', journeyToUse.id);
    console.log('🚀 voiceEnabled:', journeyToUse.voiceEnabled);
    console.log('🚀 ttsProvider:', journeyToUse.ttsProvider || 'elevenlabs');
    console.log('🚀 options:', options);
    
    // Set the current provider based on journey configuration
    currentProviderRef.current = journeyToUse.ttsProvider || 'elevenlabs';
    
    // Validate ElevenLabs configuration if selected
    if (currentProviderRef.current === 'elevenlabs' && !journeyToUse.elevenLabsConfig?.agentId) {
      const errorMsg = 'ElevenLabs Agent ID is not configured. Please add the Agent ID in the flow settings under "ElevenLabs Configuration".';
      addLog('error', errorMsg);
      setConnectionError(errorMsg);
      resetToFlowsScreen();
      return;
    }

    // Apply prompt variable substitution using sanitized flowContext from quiz answers.
    // Priority: flowContextOverride (quiz answers) > pqData (manual settings) > DEFAULT_PQ_DATA
    const rawContextToUse = flowContextOverride || flowContext || {};
    const journeyConditionKeys = collectJourneyConditionalModuleKeys(journeyToUse);
    if (journeyConditionKeys.size > 0) {
      for (const key of journeyConditionKeys) {
        recordInputDerivedKeysRef.current.add(key);
      }
    }
    const contextToUse = sanitizeSessionFlowContext(rawContextToUse);
    const pqDataToUse = { ...DEFAULT_PQ_DATA, ...pqData };
    
    console.log('📝 Prompt substitution context:', {
      flowContextKeys: Object.keys(contextToUse),
      sampleValues: {
        feelings_alcohol: contextToUse.feelings_alcohol,
        goal_alcohol: contextToUse.goal_alcohol,
        motivation: contextToUse.motivation,
        memberName: contextToUse.memberName || pqDataToUse.memberName,
      }
    });
    
    const journeyWithPQData = {
      ...journeyToUse,
      systemPrompt: journeyToUse.systemPrompt ? substitutePromptVariables(journeyToUse.systemPrompt, pqDataToUse, contextToUse) : journeyToUse.systemPrompt,
      agents: journeyToUse.agents.map(agent => ({
        ...agent,
        prompt: substitutePromptVariables(agent.prompt, pqDataToUse, contextToUse),
      })),
    };
    addLog('info', '📝 Applied quiz answers to prompts', { 
      memberName: contextToUse.memberName || pqDataToUse.memberName, 
      feelings_alcohol: contextToUse.feelings_alcohol,
      goal_alcohol: contextToUse.goal_alcohol,
    });

    // Create event trigger handler for screen navigation (needed before runtime.convert)
    const handleEventTrigger = (eventId: string, agentName: string) => {
      addLog('event', `📢 Screen event triggered: ${eventId}`, { agentName });
      
      // Special handling for feedback screen event (triggered by end_call tool)
      if (eventId === 'show_feedback_screen') {
        addLog('info', '📋 Feedback screen event triggered - navigating to feedback screen');
        // Navigate to a feedback screen if it exists in the journey
        const currentAgentConfig = journeyWithPQData.agents.find(a => {
          const name = a.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
          return name === agentName;
        });
        
        // Look for a screen with id containing 'feedback' or navigate to the first feedback screen
        const feedbackScreen = currentAgentConfig?.screens?.find(s => 
          s.id.toLowerCase().includes('feedback') || 
          s.id.toLowerCase().includes('goodbye') ||
          s.id.toLowerCase().includes('end')
        );
        
        if (feedbackScreen && navigateToScreen) {
          addLog('info', `📱 Navigating to feedback screen: ${feedbackScreen.id}`);
          navigateToScreen(feedbackScreen.id);
        } else {
          addLog('warning', '⚠️ No feedback screen found in journey - feedback modal will be shown after disconnect');
        }
        return;
      }
      
      // Special handling for permissions_screen_event - show notification permission popup
      if (eventId === 'permissions_screen_event') {
        addLog('info', '🔔 Notification permission request triggered - showing popup');
        setShowNotificationPopup(true);
        scheduleNotificationPlanReviewFallback('onEventTrigger');
        return;
      }
      
      // Find the current agent to get its screens
      const currentAgentConfig = journeyWithPQData.agents.find(a => {
        const name = a.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
        return name === agentName;
      });
      
      if (currentAgentConfig?.screens) {
        // Use ref to get the latest currentScreenId (avoids stale closure issues)
        const activeScreenId = currentScreenIdRef.current;
        
        // Screens are already shown at session start, just process the navigation
        addLog('info', `📱 Processing event "${eventId}" within ${currentAgentConfig.screens.length} screen(s), currentScreen: "${activeScreenId}"`);
        
        // CRITICAL: Only look for events on the CURRENT screen, not all screens.
        // This prevents tool calls for events that are not valid in the active screen context.
        const currentScreen = currentAgentConfig.screens.find(s => s.id === activeScreenId);
        
        if (!currentScreen) {
          addLog('warning', `⚠️ Current screen "${activeScreenId}" not found in agent screens`);
          return;
        }
        
        // Find the event in the CURRENT screen only - check both screen-level and element-level events
        let foundEvent = null;
        
        // First check screen-level events on current screen only
        if (currentScreen.events) {
          foundEvent = currentScreen.events.find(e => e.id === eventId);
        }
        
        // If not found, check element-level events on current screen only
        if (!foundEvent) {
          for (const section of currentScreen.sections) {
            for (const element of section.elements) {
              if (element.events) {
                const elementEvent = element.events.find((e: any) => e.id === eventId);
                if (elementEvent) {
                  foundEvent = elementEvent;
                  break;
                }
              }
            }
            if (foundEvent) break;
          }
        }
        
        // Log if event was not found on current screen (but might exist on other screens)
        if (!foundEvent) {
          // Check if event exists on any screen (for better error messaging)
          const allScreenEvents = currentAgentConfig.screens.flatMap(screen => [
            ...(screen.events || []),
            ...screen.sections.flatMap(s => s.elements.flatMap(e => e.events || []))
          ]);
          const eventExistsElsewhere = allScreenEvents.find(e => e.id === eventId);
          if (eventExistsElsewhere) {
            addLog('error', `❌ Event "${eventId}" exists but NOT on current screen "${activeScreenId}". The AI skipped a navigation step.`);
          }
        }
        
        if (foundEvent && foundEvent.action) {
          // Look for navigation action
          const navAction = foundEvent.action.find((a: any) => a.type === 'navigation');
          const stateAction = foundEvent.action.find((a: any) => a.type === 'stateUpdate');

          if (navAction) {
            const deeplink = (navAction as any).deeplink;
            // Use the deeplink directly as the screen ID
            const targetScreenId = deeplink;
            
            // Validate that the target screen exists
            if (currentAgentConfig?.screens) {
              const targetScreen = currentAgentConfig.screens.find(s => s.id === targetScreenId);
              if (!targetScreen) {
                addLog('error', `❌ Navigation error: Screen "${targetScreenId}" not found. Please check flow configuration.`);
                console.error(`Navigation error: Screen "${targetScreenId}" not found in screens:`, currentAgentConfig.screens.map(s => s.id));
                return;
              }
            }
            
            addLog('info', `🎯 Navigating to screen: ${targetScreenId}`);
            navigateToScreen?.(targetScreenId);
          }

          if (stateAction) {
            addLog('info', `📝 Event "${eventId}" executed state update`);
            // State updates are handled by the ScreenContext when the event is triggered
          }

          if (!navAction && !stateAction) {
            addLog('warning', `⚠️ Event "${eventId}" found but has no navigation or state action`);
          }
        } else {
          addLog('warning', `⚠️ Event "${eventId}" not found in screens or elements`);
        }
      }
    };
    
    // Convert journey to runtime agents with flow context for {{key}} prompt interpolation
    // Use override if provided (from start_journey), otherwise use current context state
    // CRITICAL: Transform quiz option IDs to readable labels before use
    const rawFlowContext = sanitizeSessionFlowContext(flowContextOverride || flowContext || {});
    const sessionFlowContext = normalizeFlowScreenContext({ ...rawFlowContext });
    // Start each session from explicit flow context only, so stale captured UI
    // values from prior sessions cannot pre-populate current-screen cards.
    const sessionModuleState = { ...sessionFlowContext };
    replaceModuleState?.(sessionModuleState);
    moduleStateRef.current = sessionModuleState;

    const effectiveFlowContext = transformQuizAnswersToLabels(sessionFlowContext);
    console.log('📊 Quiz context transformation:', {
      rawKeys: Object.keys(rawFlowContext),
      transformedSample: Object.entries(effectiveFlowContext).slice(0, 3),
    });
    const runtime = new JourneyRuntime({
      callbacks: {
        onEventTrigger: handleEventTrigger,
      },
      flowContext: effectiveFlowContext,
    });
    console.log('🚀 About to call runtime.convert');
    const { startingAgent } = runtime.convert(journeyWithPQData);
    console.log('🚀 runtime.convert returned startingAgent:', startingAgent?.name);
    if (!startingAgent) {
      console.log('🚀 EARLY EXIT: No starting agent');
      addLog('error', 'Journey has no starting agent configured');
      return;
    }
    
    // Log flow context if present
    if (Object.keys(effectiveFlowContext).length > 0) {
      addLog('info', '🔗 Flow context applied to prompts', { keys: Object.keys(effectiveFlowContext) });
    }

    const startingAgentName = getStartingAgentName(journeyWithPQData);
    currentAgentRef.current = startingAgentName;
    
    // Also set the legacy callback for backwards compatibility
    setEventTriggerCallback(handleEventTrigger);
    
    // Note: record_input is now handled through onToolCall in useAzureWebRTCSession,
    // so we don't need to set a separate callback here

    // Check if starting agent has screens
    const startingAgentConfig = journeyWithPQData.agents.find(a => a.id === journeyWithPQData.startingAgentId);
    
    if (startingAgentConfig?.screens && startingAgentConfig.screens.length > 0) {
      addLog('info', `🎨 Screen system ready with ${startingAgentConfig.screens.length} screens`);
      
      // Skip screen reset when enabling voice mid-flow (screens are already showing)
      if (!options?.skipScreenReset) {
        addLog('info', `📱 Showing first screen: ${startingAgentConfig.screens[0].id}`);
        // Show the first screen immediately when session starts
        enableScreenRendering?.(startingAgentConfig.screens, startingAgentConfig.screens[0].id);
        setHasScreensVisible(true);
      } else {
        addLog('info', `📱 Keeping current screen (skipScreenReset=true)`);
      }
    } else {
      addLog('warning', '⚠️ Starting agent has no screens configured');
    }

    // Clear previous session logs
    sessionLogsRef.current = [];
    setSessionLogs([]);
    userUtteranceCountRef.current = 0;
    userUtterancesByScreenRef.current = {};
    userHasSpokenOnScreenRef.current.clear();
    addLog('info', `Initiating connection with journey: ${journeyToUse.name}`);
    addLog('info', `Starting agent: ${startingAgent.name}`);

    // NOTE: elevenLabsClientTools are now defined at component level (useMemo)
    // and passed to useElevenLabsSession hook at init time, NOT to connect().
    // This is required by the ElevenLabs SDK - tools must be registered at hook init.

    try {
      // Get starting agent config (reuse the one we already found with PQ data applied)
      const startingAgentConfigForConnect = journeyWithPQData.agents.find(a => a.id === journeyWithPQData.startingAgentId);
      if (!startingAgentConfigForConnect) {
        throw new Error('Starting agent not found in journey');
      }

      // Build combined instructions: system + agent + screen prompts
      console.log('🔍 PROMPT SOURCES:');
      console.log('  Journey systemPrompt length:', journeyWithPQData.systemPrompt?.length || 0);
      console.log('  Journey systemPrompt first 200 chars:', journeyWithPQData.systemPrompt?.substring(0, 200));
      console.log('  Agent prompt length:', startingAgentConfigForConnect.prompt?.length || 0);
      console.log('  Agent prompt first 200 chars:', startingAgentConfigForConnect.prompt?.substring(0, 200));
      addLog('info', `🔍 Journey systemPrompt: ${journeyWithPQData.systemPrompt?.length || 0} chars, Agent prompt: ${startingAgentConfigForConnect.prompt?.length || 0} chars`);
      
      const instructionParts = [
        journeyWithPQData.systemPrompt,
        startingAgentConfigForConnect.prompt,
      ];
      
      // If voice is enabled mid-flow, add instruction to start at the current screen
      const currentScreenFromContext = effectiveFlowContext?.currentScreen as string | undefined;
      if (currentScreenFromContext) {
        const startingScreenInstruction = `\n---\nCRITICAL: STARTING SCREEN\n---\n\nYou are starting on screen "${currentScreenFromContext}". Begin the conversation using the instructions for that specific screen. Do NOT start from the first screen - the user has already completed previous screens.\n`;
        instructionParts.unshift(startingScreenInstruction);
        console.log('🎤 Added starting screen instruction:', currentScreenFromContext);
      }

      const screenPromptAppendix = buildScreenPromptsAppendix({
        agentPrompt: startingAgentConfigForConnect.prompt,
        screenPrompts: startingAgentConfigForConnect.screenPrompts,
        screens: startingAgentConfigForConnect.screens as AgentScreen[] | undefined,
        startScreenId: currentScreenFromContext,
      });
      if (screenPromptAppendix.text) {
        instructionParts.push(screenPromptAppendix.text);
        const totalScreenPrompts = Object.keys(startingAgentConfigForConnect.screenPrompts || {}).length;
        if (screenPromptAppendix.appendedAsOverride) {
          addLog(
            'info',
            `🧭 Appended ${screenPromptAppendix.includedScreenIds.length}/${totalScreenPrompts} runtime screen overrides to supersede embedded prompt screens.`
          );
        } else if (totalScreenPrompts > screenPromptAppendix.includedScreenIds.length) {
          addLog(
            'info',
            `🧭 Appended ${screenPromptAppendix.includedScreenIds.length}/${totalScreenPrompts} screen prompts reachable from "${currentScreenFromContext}".`
          );
        }
      } else if (screenPromptAppendix.skippedBecauseEmbedded) {
        addLog(
          'info',
          '🧭 Skipped appending screen prompts because the agent prompt already contains screen-level instructions.'
        );
      }
      
      // Add personalization quiz answers as context for the AI
      // This provides the AI with user's quiz responses for reference during conversation
      if (Object.keys(effectiveFlowContext).length > 0) {
        const quizContextLines = Object.entries(effectiveFlowContext)
          .filter(([_, value]) => value !== undefined && value !== null && value !== '')
          .map(([key, value]) => `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        
        if (quizContextLines.length > 0) {
          const quizContextSection = `\n## USER CONTEXT (Personalization Quiz Answers)\nThe user has provided the following information during their personalization quiz. Use this context to personalize your responses:\n${quizContextLines.join('\n')}`;
          instructionParts.push(quizContextSection);
          addLog('info', `📝 Added ${quizContextLines.length} quiz answer(s) to prompt context`);
        }
      }

      const combinedInstructions = instructionParts.filter(Boolean).join('\n\n');
      // System tools are always added by journeyRuntime regardless of journey config
      const systemToolNames = new Set([
        'trigger_event', 'record_input', 'end_call',
        'set_checkin_frequency', 'set_reminder_time',
        'set_goals', 'capture_weekly_focus', 'setVoiceEnabled', 'navigate_to',
      ]);
      const declaredToolNames = new Set([
        ...systemToolNames,
        ...(startingAgentConfigForConnect.tools || [])
          .map((tool) => tool?.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0),
      ]);
      const promptReferencedToolNames = getPromptReferencedToolNames(
        combinedInstructions,
        PROMPT_TOOL_NAME_CANDIDATES
      );
      const missingDeclaredTools = promptReferencedToolNames.filter(
        (toolName) => !declaredToolNames.has(toolName)
      );
      if (currentProviderRef.current === 'elevenlabs' && missingDeclaredTools.length > 0) {
        addLog(
          'warning',
          `⚠️ Prompt references tools missing from journey config: ${missingDeclaredTools.join(', ')}.`
        );
      }

      // Check prompt size - WebRTC has a 64KB limit
      const promptBytes = new TextEncoder().encode(combinedInstructions).length;
      const MAX_PROMPT_BYTES = 60000; // Leave some headroom below 65535
      console.log(`📏 Combined prompt size: ${promptBytes} bytes (${(promptBytes / 1024).toFixed(1)} KB)`);
      if (promptBytes > MAX_PROMPT_BYTES) {
        console.error(`🔴 PROMPT TOO LARGE! ${promptBytes} bytes exceeds ${MAX_PROMPT_BYTES} byte limit`);
        addLog('error', `Prompt too large (${(promptBytes / 1024).toFixed(1)} KB) - WebRTC limit is ~60KB. Reduce screen prompts or agent instructions.`);
        setConnectionError(`Prompt is too large (${(promptBytes / 1024).toFixed(1)} KB). Please reduce the size of your screen prompts or agent instructions. WebRTC has a ~60KB limit.`);
        resetToFlowsScreen();
        return;
      }

      // Store combined prompt for export
      combinedPromptRef.current = combinedInstructions;

      // Create journey agent config for WebRTC session
      // Convert journey tools to Azure format
      const azureTools = (startingAgentConfigForConnect.tools || []).map(tool => ({
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));

      // Use settings override, then journey voice, then agent voice
      const journeyVoice = selectedVoice || journeyWithPQData.voice || startingAgentConfigForConnect.voice || 'shimmer';

      const journeyAgentConfig = {
        name: startingAgentName,
        instructions: combinedInstructions,
        voice: journeyVoice,
        tools: azureTools, // Send tools to Azure so it knows to call them
        handoffs: startingAgentConfigForConnect.handoffs || [],
      };

      // Build map of all journey agents for handoff support
      const allJourneyAgentsMap = new Map();
      journeyWithPQData.agents.forEach(agent => {
        const agentName = agent.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());

        // Build instructions for this agent
        const agentInstructionParts = [
          journeyWithPQData.systemPrompt,
          agent.prompt,
        ];

        const agentScreenPromptAppendix = buildScreenPromptsAppendix({
          agentPrompt: agent.prompt,
          screenPrompts: agent.screenPrompts,
          screens: agent.screens as AgentScreen[] | undefined,
        });
        if (agentScreenPromptAppendix.text) {
          agentInstructionParts.push(agentScreenPromptAppendix.text);
        }

        allJourneyAgentsMap.set(agentName, {
          name: agentName,
          instructions: agentInstructionParts.filter(Boolean).join('\n\n'),
          voice: selectedVoice || journeyWithPQData.voice || agent.voice || 'shimmer', // Use journey voice for consistency
          handoffs: agent.handoffs || [],
        });
      });

      addLog('info', `📋 Agent configuration prepared (${combinedInstructions.length} chars)`);
      addLog('info', `🎵 Using voice: ${journeyAgentConfig.voice}`);
      addLog('info', `👥 Journey has ${allJourneyAgentsMap.size} agent(s) configured`);

      if (personaEnabled && personaDescription) {
        // Persona mode: Set up audio routing destinations first
        audioRouterRef.current = new VoiceAgentAudioRouter();
        const { personaMicStream, agentMicStream } = 
          await audioRouterRef.current.setupBidirectionalRouting(sdkAudioElement!, personaAudioElement);
        // Preflight mic stream is only for permission in persona mode.
        releaseOwnedMicStream('persona mode uses routed streams');
        setMicStream(null);
        
        // Convert flow context to string values for ElevenLabs dynamic variables
        const dynamicVariables: Record<string, string> = {};
        Object.entries(effectiveFlowContext).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            dynamicVariables[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
          }
        });
        
        // Connect agent with routed mic and journey agent config
        await connect({
          audioElement: sdkAudioElement,
          customMicStream: agentMicStream,
          // Pass system prompt explicitly for ElevenLabs
          systemPrompt: journeyWithPQData.systemPrompt,
          agentConfig: journeyAgentConfig,
          allJourneyAgents: allJourneyAgentsMap,
          screens: startingAgentConfigForConnect.screens,
          onEventTrigger: handleEventTrigger,
          onEndCall: handleEndCall,
          // ElevenLabs-specific options
          elevenLabsAgentId: journeyToUse.elevenLabsConfig?.agentId,
          elevenLabsVoiceId: journeyToUse.elevenLabsConfig?.voiceId,
          // Pass quiz answers as dynamic variables for {{variable}} substitution
          dynamicVariables: Object.keys(dynamicVariables).length > 0 ? dynamicVariables : undefined,
          // NOTE: clientTools are passed to useElevenLabsSession hook, not connect()
        });
        addLog('success', 'Successfully initiated voice agent connection');
        
        addLog('info', '🎭 Connecting persona voice session...');
        
        // Small delay to ensure agent connection is stable
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        try {
          await connectPersona({
            audioElement: personaAudioElement,
            customMicStream: personaMicStream, // Route agent audio to persona
            skipInitialGreeting: true, // Persona waits for agent to speak first
            voice: 'shimmer', // Use different voice to distinguish from agent (alloy)
            customInstructions: `${personaDescription}

You are role-playing as this person in a conversation with a counsellor from Pelago (a substance use recovery program). 

CRITICAL: You will hear the counsellor speaking through your microphone. Respond immediately and naturally when you hear them speak. Don't wait for silence - jump in with your response.

Respond naturally and authentically as this person would. Keep responses conversational and realistic - usually 1-3 sentences unless asked for more detail.

Important guidelines:
- Respond as the person described, not as an AI
- Be honest about your struggles and motivations  
- Show realistic emotions and reactions
- Don't be overly formal or clinical
- Answer questions directly but naturally
- You can express uncertainty, concern, hope, or other genuine emotions
- Speak in a natural, conversational tone
- Respond promptly when you hear the counsellor speak`,
          } as any);
        } catch (personaErr: any) {
          console.error("Error connecting persona:", personaErr);
          addLog('error', '🎭 Failed to connect persona', { error: personaErr.message });
        }
      } else {
        // Normal mode: Connect agent with regular microphone and journey agent config
        console.log('🎙️ About to call connect() with agentConfig:', journeyAgentConfig.name);
        console.log('🎙️ sdkAudioElement:', !!sdkAudioElement);
        console.log('🎙️ provider:', currentProviderRef.current);
        addLog('info', `🎙️ Initiating ${currentProviderRef.current === 'elevenlabs' ? 'ElevenLabs' : 'Azure'} connection...`);
        
        // Convert flow context to string values for ElevenLabs dynamic variables
        const dynamicVariables: Record<string, string> = {};
        Object.entries(effectiveFlowContext).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            dynamicVariables[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
          }
        });
        if (Object.keys(dynamicVariables).length > 0) {
          addLog('info', `🔗 Passing ${Object.keys(dynamicVariables).length} dynamic variable(s) to ElevenLabs`);
        }
        
        const usePromptOverride = journeyToUse.elevenLabsConfig?.usePromptOverride !== false;
        if (usePromptOverride) {
          addLog('info', `📝 PROMPT OVERRIDE: ${combinedInstructions.length} chars being sent to ElevenLabs`);
          addLog('info', `📝 Override starts with: "${combinedInstructions.substring(0, 150).replace(/\n/g, ' ')}..."`);
          addLog('info', `📝 Override JSON size: ${new TextEncoder().encode(JSON.stringify({ agent: { prompt: { prompt: combinedInstructions } } })).length} bytes`);
        } else {
          addLog('info', '📝 Prompt override DISABLED - using ElevenLabs dashboard prompt (supports complex multi-agent workflows)');
        }
        const shouldUsePreflightMicStream = currentProviderRef.current === 'azure';
        
        await connect({
          audioElement: sdkAudioElement,
          customMicStream: shouldUsePreflightMicStream ? microphoneStream : undefined,
          systemPrompt: journeyWithPQData.systemPrompt,
          agentConfig: journeyAgentConfig,
          allJourneyAgents: allJourneyAgentsMap,
          screens: startingAgentConfigForConnect.screens,
          onEventTrigger: handleEventTrigger,
          onEndCall: handleEndCall,
          elevenLabsAgentId: journeyToUse.elevenLabsConfig?.agentId,
          elevenLabsVoiceId: journeyToUse.elevenLabsConfig?.voiceId,
          dynamicVariables: Object.keys(dynamicVariables).length > 0 ? dynamicVariables : undefined,
          promptOverride: usePromptOverride ? combinedInstructions : undefined,
        });
        if (!shouldUsePreflightMicStream) {
          // ElevenLabs handles microphone capture internally after permission is granted.
          releaseOwnedMicStream('provider manages its own mic stream');
          setMicStream(null);
        }
        console.log('🎙️ connect() completed');
        addLog('success', `Successfully initiated ${currentProviderRef.current === 'elevenlabs' ? 'ElevenLabs' : 'Azure'} connection`);
      }
      
      // Configure real-time saver with session info (only if user is authenticated)
      if (user) {
        // Read Prolific params from localStorage (set by MobilePreview page)
        const prolificPid = localStorage.getItem('prolific-pid');
        const prolificStudyId = localStorage.getItem('prolific-study-id');
        const prolificSessionId = localStorage.getItem('prolific-session-id');
        
        const prolificData = (prolificPid || prolificStudyId || prolificSessionId) ? {
          participantId: prolificPid || undefined,
          studyId: prolificStudyId || undefined,
          sessionId: prolificSessionId || undefined,
        } : undefined;
        
        sessionSaverRef.current.configure(
          sessionIdRef.current,
          journeyToUse ? {
            id: journeyToUse.id,
            name: journeyToUse.name,
            voice: journeyToUse.voice,
          } : undefined,
          {
            id: startingAgentName,
            name: startingAgentName,
            prompt: combinedInstructions,
            tools: azureTools,
          },
          prolificData,
          () => loggedEventsRef.current,
          () => sessionLogsRef.current.map(log => ({
            timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
            type: log.type,
            message: log.message,
            details: log.details,
          })),
        );
      }
    } catch (err: any) {
      releaseOwnedMicStream('connect failure');
      setMicStream(null);
      resetAudioElement(audioElementRef.current, 'primary');
      resetAudioElement(personaAudioElement, 'persona');
      console.error("Error connecting to Azure OpenAI:", err);
      addLog('error', 'Failed to connect to Azure OpenAI', { error: err.message });
      resetToFlowsScreen();
    }
  };

  // Keep connectToRealtimeRef updated with latest function
  useEffect(() => {
    connectToRealtimeRef.current = connectToRealtime;
  });
  
  // Keep currentJourneyRef updated with latest journey
  useEffect(() => {
    currentJourneyRef.current = currentJourney;
  }, [currentJourney]);

  // Handle setVoiceEnabled tool - called directly from ScreenContext to preserve user gesture context
  // This MUST be called synchronously during button click for mic permission to work
  const handleSetVoiceEnabled = useCallback((enabled: boolean) => {
    console.log(`🎤🎤🎤 handleSetVoiceEnabled CALLED DIRECTLY (preserves user gesture): enabled=${enabled} 🎤🎤🎤`);

    if (!enabled) {
      // Disable voice mode - disconnect and switch to button-based navigation
      addLog('info', '🎤 Disabling voice mode');
      disconnectFromRealtime();
      setIsNonVoiceMode(true);
      return;
    }

    addLog('info', '🎤 Enabling voice mode mid-flow');

    // Get journey from ref SYNCHRONOUSLY (avoid closure issues)
    const journey = currentJourneyRef.current;
    console.log('🎤 Journey from ref:', journey?.name);
    console.log('🎤 Journey elevenLabsConfig:', journey?.elevenLabsConfig);
    console.log('🎤 Journey ttsProvider:', journey?.ttsProvider);

    if (!journey) {
      console.error('🎤 ERROR: No journey in currentJourneyRef!');
      addLog('error', 'No journey found - cannot enable voice');
      resetToFlowsScreen();
      return;
    }

    // Check if ElevenLabs is configured
    if (!journey.elevenLabsConfig?.agentId) {
      console.error('🎤 ERROR: ElevenLabs Agent ID not configured on journey!');
      console.error('🎤 Journey elevenLabsConfig:', JSON.stringify(journey.elevenLabsConfig));
      addLog('error', 'ElevenLabs Agent ID not configured - please add it in Journey Builder settings');
      setConnectionError('ElevenLabs Agent ID is not configured. Please add it in the flow settings.');
      resetToFlowsScreen();
      return;
    }
    
    if (!connectToRealtimeRef.current) {
      console.error('🎤 ERROR: connectToRealtimeRef.current is null!');
      addLog('error', 'Voice connection function not available');
      resetToFlowsScreen();
      return;
    }
    
    // Set transitioning flag to prevent flows list from flashing
    setIsTransitioningJourney(true);
    
    // Exit non-voice mode
    setIsNonVoiceMode(false);
    
    // Force session to disconnected state to allow reconnection
    setSessionStatus('DISCONNECTED');
    setActiveSpeaker('none');
    setMemberAudioLevel(0);
    
    // Transform quiz answers from option IDs to readable labels
    const transformedModuleState = moduleState ? transformQuizAnswersToLabels(moduleState) : {};
    
    // Add memberName from user context if available (extract first name only)
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0];
      // Extract first name from email prefix (handles john.doe, john_doe, johndoe formats)
      const firstName = emailPrefix.split(/[._-]/)[0];
      // Capitalize first letter
      transformedModuleState.memberName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }
    
    // Get current screen ID to tell agent where we are in the flow
    const activeScreenId = currentScreenIdRef.current;
    console.log('🎤 Current screen when enabling voice:', activeScreenId);
    
    // Merge flow context for data passing (use transformed labels for readable prompts)
    // Include currentScreen so the agent knows where to start
    const mergedContext = normalizeFlowScreenContext({
      ...sanitizeSessionFlowContext(flowContext || {}),
      ...sanitizeSessionFlowContext(transformedModuleState),
      ...(activeScreenId ? { currentScreen: activeScreenId, current_screen: activeScreenId } : {}),
    });
    
    // Update flowContext state for consistency
    if (updateFlowContext && moduleState) {
      updateFlowContext(
        normalizeFlowScreenContext(sanitizeSessionFlowContext(transformedModuleState))
      );
    }
    
    addLog('info', `🎤 Flow context keys: ${Object.keys(mergedContext).join(', ')}`);
    console.log('🎤 Transformed quiz answers:', transformedModuleState);
    
    // Continue with the current journey and just enable voice mode
    // Previously this switched to Intake Navigator, but that caused screen reset issues
    // Now we preserve the current journey and screen position
    const voiceJourney: Journey = {
      ...journey,
      voiceEnabled: true, // Enable voice mode on current journey
    };
    console.log('🎤 Enabling voice mode on current journey:', voiceJourney.name);
    
    console.log('🎤 Calling connectToRealtime SYNCHRONOUSLY');
    console.log('🎤 Journey:', voiceJourney.name, 'voiceEnabled:', voiceJourney.voiceEnabled);
    
    // CRITICAL: Call connectToRealtime SYNCHRONOUSLY to preserve user gesture context
    // Always skip screen reset to preserve current screen position during voice transitions
    const shouldSkipScreenReset = true;
    try {
      connectToRealtimeRef.current(voiceJourney, mergedContext, { skipScreenReset: shouldSkipScreenReset });
      console.log('🎤 connectToRealtime call initiated, skipScreenReset:', shouldSkipScreenReset);
    } catch (err) {
      console.error('🎤 ERROR calling connectToRealtime:', err);
      addLog('error', `Failed to enable voice: ${err}`);
      setIsTransitioningJourney(false);
    }
  }, [addLog, flowContext, moduleState, normalizeFlowScreenContext, sanitizeSessionFlowContext, updateFlowContext, user]);

  // Export transcript when session ends
  const getCurrentAgentFromJourney = () => {
    return currentJourney?.agents?.find((agent) => {
      const runtimeName = normalizeAgentNameForRuntime(agent.name);
      return (
        agent.name === currentAgentRef.current ||
        agent.id === currentAgentRef.current ||
        runtimeName === currentAgentRef.current
      );
    });
  };

  const mapJourneyToolsToAgentTools = (journeyTools: any[]): any[] => {
    return journeyTools.map(t => ({
      type: 'function' as const,
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object', properties: {} },
    }));
  };

  const exportSessionTranscript = () => {
    if (transcriptItems.length === 0) {
      addLog('warning', 'No transcript to export');
      return;
    }

    const currentAgent = getCurrentAgentFromJourney();
    const agentConfig = combinedPromptRef.current ? {
      name: currentAgentRef.current,
      publicDescription: '',
      instructions: combinedPromptRef.current,
      tools: mapJourneyToolsToAgentTools(currentAgent?.tools || []),
    } : undefined;

    const sessionExport = createSessionExport({
      sessionId: sessionIdRef.current,
      transcript: transcriptItems,
      events: loggedEvents,
      journey: currentJourney || undefined,
      agentConfig,
      screens: currentAgent?.screens,
      flowContext: flowContext || {},
      debugLogs: sessionLogs.map(log => ({
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
        type: log.type,
        message: log.message,
        details: log.details,
      })),
      pqData: pqData,
    });

    // Download formatted transcript (human-readable) instead of raw JSON
    downloadFormattedTranscript(sessionExport);
    addLog('success', `📥 Transcript exported: ${sessionExport.stats.totalMessages} messages`);
  };

  // Download just the prompt
  const exportPrompt = () => {
    if (!combinedPromptRef.current) {
      addLog('warning', 'No prompt to export');
      return;
    }
    downloadPrompt(combinedPromptRef.current, sessionIdRef.current);
    addLog('success', '📥 Prompt exported');
  };

  // Download both prompt and transcript
  const exportPromptAndTranscript = () => {
    if (transcriptItems.length === 0 && !combinedPromptRef.current) {
      addLog('warning', 'Nothing to export');
      return;
    }

    const currentAgent = getCurrentAgentFromJourney();
    const agentConfig = combinedPromptRef.current ? {
      name: currentAgentRef.current,
      publicDescription: '',
      instructions: combinedPromptRef.current,
      tools: mapJourneyToolsToAgentTools(currentAgent?.tools || []),
    } : undefined;

    const sessionExport = createSessionExport({
      sessionId: sessionIdRef.current,
      transcript: transcriptItems,
      events: loggedEvents,
      journey: currentJourney || undefined,
      agentConfig,
      screens: currentAgent?.screens,
      flowContext: flowContext || {},
      debugLogs: sessionLogs.map(log => ({
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
        type: log.type,
        message: log.message,
        details: log.details,
      })),
      pqData: pqData,
    });

    downloadPromptAndTranscript(sessionExport);
    addLog('success', '📥 Prompt and transcript exported');
  };

  // Download raw JSON export (for developers/iteration)
  const exportRawSession = () => {
    if (transcriptItems.length === 0) {
      addLog('warning', 'No session data to export');
      return;
    }

    const currentAgent = getCurrentAgentFromJourney();
    const agentConfig = combinedPromptRef.current ? {
      name: currentAgentRef.current,
      publicDescription: '',
      instructions: combinedPromptRef.current,
      tools: mapJourneyToolsToAgentTools(currentAgent?.tools || []),
    } : undefined;

    const sessionExport = createSessionExport({
      sessionId: sessionIdRef.current,
      transcript: transcriptItems,
      events: loggedEvents,
      journey: currentJourney || undefined,
      agentConfig,
      screens: currentAgent?.screens,
      flowContext: flowContext || {},
      debugLogs: sessionLogs.map(log => ({
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
        type: log.type,
        message: log.message,
        details: log.details,
      })),
      pqData: pqData,
    });

    downloadSessionExport(sessionExport);
    addLog('success', '📥 Raw session JSON exported');
  };

  const disconnectFromRealtime = async (forceShowFeedback: boolean = false) => {
    if (isDisconnectingRef.current) {
      addLog('info', 'Disconnect already in progress');
      return;
    }
    isDisconnectingRef.current = true;

    pendingNavigationRef.current = null;
    queuedPostNavigationEventRef.current = null;
    lastRecordInputRef.current = null;
    addLog('info', 'Disconnecting from session...');

    try {
      if (disableScreenRendering) {
        disableScreenRendering();
      }

      // Flush any pending real-time saves first
      try {
        await sessionSaverRef.current.flush();
      } catch (error) {
        console.error('Failed to flush pending saves:', error);
      }

      // Auto-save complete session (supports both authenticated and anonymous users)
      let sessionSaved = false;
      if (transcriptItems.length > 0) {
        try {
          const currentAgent = getCurrentAgentFromJourney();
          const agentConfig = combinedPromptRef.current ? {
            name: currentAgentRef.current,
            publicDescription: '',
            instructions: combinedPromptRef.current,
            tools: mapJourneyToolsToAgentTools(currentAgent?.tools || []),
          } : undefined;

          const sessionExport = createSessionExport({
            sessionId: sessionIdRef.current,
            transcript: transcriptItems,
            events: loggedEvents,
            journey: currentJourney || undefined,
            screens: currentAgent?.screens,
            agentConfig,
            flowContext: flowContext || {},
            debugLogs: sessionLogs.map(log => ({
              timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : String(log.timestamp),
              type: log.type,
              message: log.message,
              details: log.details,
            })),
            pqData: pqData,
          });

          await saveSession(sessionExport);
          addLog('success', 'Session auto-saved to cloud');
          sessionSaved = true;
          
          // Set feedback session ID for feedback form
          setFeedbackSessionId(sessionIdRef.current);
        } catch (error) {
          console.error('Failed to auto-save session:', error);
          addLog('warning', 'Failed to auto-save session to cloud');
        }
      }

      // Reset the real-time saver
      sessionSaverRef.current.reset();

      const elConversationId = await disconnect();

      if (elConversationId && currentProviderRef.current === 'elevenlabs') {
        const capturedSessionId = sessionIdRef.current;
        addLog('info', 'Fetching ElevenLabs server-side conversation data...');
        setTimeout(() => {
          fetchElevenLabsConversation(capturedSessionId, elConversationId).then((result) => {
            console.log('✅ ElevenLabs conversation data fetched:', result?.entriesAdded, 'entries added');
          }).catch((err) => {
            console.warn('⚠️ Failed to fetch ElevenLabs conversation data (non-blocking):', err);
          });
        }, 5000);
      }

      // Disconnect persona if connected
      if (personaStatus !== 'DISCONNECTED') {
        disconnectPersona();
        addLog('info', '🎭 Persona disconnected');
      }

      // Clean up audio routing
      if (audioRouterRef.current) {
        audioRouterRef.current.cleanup();
        audioRouterRef.current = null;
      }

      // Tell the browser we're done with mic/audio resources for this call.
      releaseOwnedMicStream('session disconnect');
      setMicStream(null);
      resetAudioElement(audioElementRef.current, 'primary');
      resetAudioElement(personaAudioElement, 'persona');
      setIsMicMuted(false);
      setActiveSpeaker('none');
      setMemberAudioLevel(0);

      setSessionStatus("DISCONNECTED");
      addLog('success', 'Disconnected successfully');
      
      // Show feedback form if session was saved successfully, in preview mode, or force requested (end_call tool)
      if (sessionSaved || isPreviewMode || forceShowFeedback) {
        // Ensure feedbackSessionId is set for the form to render
        if (!feedbackSessionId) {
          setFeedbackSessionId(sessionIdRef.current);
        }
        setShowFeedbackForm(true);
      }
    } finally {
      isDisconnectingRef.current = false;
    }
  };

  // Keep disconnectFromRealtimeRef updated for client tools to call
  useEffect(() => {
    disconnectFromRealtimeRef.current = disconnectFromRealtime;
  });

  // Removed sendSimulatedUserMessage - not needed for Azure WebSocket

  // Audio is handled by the WebSocket client (Azure) or internally by SDK (ElevenLabs)

  const setPreviewCaptureElement = useCallback((element: HTMLDivElement | null) => {
    previewCaptureElementRef.current = element;
  }, []);

  const getAgentAudioStreamForPreviewRecording = useCallback((): MediaStream | null => {
    const audioElement = audioElementRef.current;
    if (!audioElement) return null;

    if (audioElement.srcObject instanceof MediaStream && audioElement.srcObject.getAudioTracks().length > 0) {
      return audioElement.srcObject;
    }

    const streamFactory = (
      (audioElement as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream
      || (audioElement as HTMLAudioElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream
    );
    if (streamFactory) {
      const captured = streamFactory.call(audioElement);
      if (captured.getAudioTracks().length > 0) {
        return captured;
      }
    }

    return null;
  }, []);

  const handleStartPreviewRecording = useCallback(async () => {
    const previewElement = previewCaptureElementRef.current;
    if (!previewElement) {
      const message = 'Preview recorder is not ready yet.';
      addLog('warning', message);
      setPreviewRecordingNotice({ kind: 'error', message });
      return;
    }
    const agentAudioStream = getAgentAudioStreamForPreviewRecording();

    try {
      setPreviewRecordingNotice({
        kind: 'info',
        message: 'Preparing recording. Select this browser tab and enable Share tab audio in the share dialog.',
      });
      await startPreviewRecording({
        previewElement,
        agentAudioStream,
        micStream,
      });
      addLog('info', 'Started preview recording');
      setPreviewRecordingNotice({
        kind: 'success',
        message: 'Recording started.',
      });
    } catch (error) {
      const message = `Failed to start preview recording: ${(error as Error).message}`;
      addLog('warning', message);
      setPreviewRecordingNotice({ kind: 'error', message });
    }
  }, [addLog, getAgentAudioStreamForPreviewRecording, micStream, startPreviewRecording]);

  const handleStopPreviewRecording = useCallback(async () => {
    setPreviewRecordingNotice({
      kind: 'info',
      message: 'Finalizing recording...',
    });
    const blob = await stopPreviewRecording();
    if (blob) {
      addLog('success', 'Preview recording completed');
      setPreviewRecordingNotice({
        kind: 'success',
        message: 'Recording saved in this session. Tap Save to download.',
      });
      return;
    }
    const message = 'Preview recording stopped without media output';
    addLog('warning', message);
    setPreviewRecordingNotice({ kind: 'error', message });
  }, [addLog, stopPreviewRecording]);

  useEffect(() => {
    if (!previewRecordingError) return;
    setPreviewRecordingNotice({
      kind: 'error',
      message: previewRecordingError,
    });
  }, [previewRecordingError]);

  useEffect(() => {
    if (sessionStatus !== 'CONNECTED') {
      setPreviewRecordingNotice(null);
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      // ElevenLabs handles audio internally via WebRTC - no need to set up audio element
      if (currentProviderRef.current === 'elevenlabs') {
        console.log('🔊 ElevenLabs handles audio internally - skipping audio element setup');
        return;
      }

      // Azure: Don't create a separate mic stream - it causes feedback/crackling
      // The WebRTC connection already has the microphone
      // We'll set micStream to null to disable audio visualization
      // This prevents duplicate microphone access which causes issues

      // Start recording when audio stream becomes available
      // The audio stream is assigned asynchronously via ontrack event
      const checkAndStartRecording = () => {
        if (audioElementRef.current?.srcObject) {
          const remoteStream = audioElementRef.current.srcObject as MediaStream;
          startRecording(remoteStream);

          // Also start streaming recording to server (pass session ID to link with transcript)
          startStreamingRecording(remoteStream, sessionIdRef.current).catch((error) => {
            console.error('Failed to start streaming recording:', error);
            addLog('warning', 'Streaming recording failed to start');
          });
          return true;
        }
        return false;
      };

      // Try immediately, then poll until audio stream is available
      if (!checkAndStartRecording()) {
        console.log('🎙️ Audio stream not ready, polling...');
        const pollInterval = setInterval(() => {
          if (checkAndStartRecording()) {
            console.log('🎙️ Audio stream found, recording started');
            clearInterval(pollInterval);
          }
        }, 100);
        // Clean up after 10 seconds to avoid infinite polling
        setTimeout(() => {
          clearInterval(pollInterval);
          console.log('🎙️ Polling timed out waiting for audio stream');
        }, 10000);
      } else {
        console.log('🎙️ Recording started immediately');
      }
    }

    // Cleanup on disconnect (but NOT during journey transitions - we're about to start a new session)
    console.log('🔍 Cleanup effect check:', { sessionStatus, isTransitioningJourney });
    if (sessionStatus === "DISCONNECTED" && !isTransitioningJourney) {
      console.log('🧹 Running cleanup - stopping recording');
      // If we ever add mic visualization, ensure those tracks are stopped
      if (micStream) {
        console.log('🧹 Cleaning up microphone stream');
        micStream.getTracks().forEach(track => track.stop());
        if (ownedMicStreamRef.current === micStream) {
          ownedMicStreamRef.current = null;
        }
        setMicStream(null);
      }
      // Always stop recording to release mic usage
      stopRecording();

      // Stop streaming recording
      stopStreamingRecording().catch((error) => {
        console.error('Failed to stop streaming recording:', error);
      });

      if (isPreviewRecording || previewRecordingStatus === 'starting' || previewRecordingStatus === 'stopping') {
        stopPreviewRecording().catch((error) => {
          console.error('Failed to stop preview recording:', error);
        });
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, isTransitioningJourney]);

  // Suppress unused customPrompts setter (kept for future prompt customization feature)
  void setCustomPrompts;

  const handleImportNewFlow = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        const response = await fetch('/api/journeys/import-new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(importData),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to import flow');
        }
        
        const result = await response.json();
        const newJourney = result.data;
        
        addLog('info', `✅ Imported flow "${newJourney.name}" successfully`);
        alert(`Flow "${newJourney.name}" imported successfully!`);
        
        navigate(`/builder?id=${newJourney.id}`);
      } catch (error) {
        console.error('Import error:', error);
        const message = error instanceof Error ? error.message : 'Failed to import flow';
        addLog('error', `❌ Import failed: ${message}`);
        alert(`Import failed: ${message}`);
      }
    };
    input.click();
  };

  const handlePersonaChange = (enabled: boolean, description: string) => {
    setPersonaEnabled(enabled);
    setPersonaDescription(description);

    // Persist to localStorage
    localStorage.setItem('voice-agent-persona-enabled', JSON.stringify(enabled));
    localStorage.setItem('voice-agent-persona-description', description);

    if (enabled) {
      addLog('info', '🎭 Persona voice testing enabled', { description: description.substring(0, 100) });
    } else {
      addLog('info', '🎭 Persona voice testing disabled');
    }
  };

  const handlePQDataChange = (data: Partial<PQData>) => {
    setPQData(data);
    localStorage.setItem('voice-agent-pq-data', JSON.stringify(data));
    addLog('info', '📝 PQ data updated', { memberName: data.memberName, primaryGoal: data.primaryGoal });
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem('voice-agent-selected-voice', voice);
    addLog('info', voice ? `🎵 Voice set to ${voice}` : '🎵 Voice set to journey default');
  };

  const audioRouterRef = useRef<VoiceAgentAudioRouter | null>(null);
  
  const {
    connect: connectPersona,
    disconnect: disconnectPersona,
    status: personaStatus,
  } = useAzureWebRTCSession();

  // Track which provider to use (determined by journey)
  const currentProviderRef = useRef<'azure' | 'elevenlabs'>('elevenlabs');

  const handleVoiceEvent = (event: any) => {
    logServerEvent(event);

    // Fallback text path: some providers emit utterance text on generic events
    // instead of (or before) transcript callbacks.
    if (typeof event?.message === 'string' && event.message.trim()) {
      if (event.source === 'ai') {
        const isElevenLabsProvider = currentProviderRef.current === 'elevenlabs';
        const canApplyElevenLabsFallback = !isElevenLabsProvider || lastElevenLabsModeRef.current === 'speaking';
        if (canApplyElevenLabsFallback) {
          if (isElevenLabsProvider && alignmentReceivedForTurnRef.current) {
            pendingTranscriptTextRef.current = event.message;
          } else {
            updateLiveAgentMessageProgressively(event.message);
          }
        }
      } else if (event.source === 'user') {
        shouldResetLiveAgentMessageOnNextAssistantTextRef.current = true;
        setAgentSpeechAlignment(null);
        const activeScreenId = currentScreenIdRef.current;
        if (activeScreenId) {
          userHasSpokenOnScreenRef.current.add(activeScreenId);
        }
        agentSpeechPlaybackAnchorRef.current = null;
        setAgentSpeechPlaybackAnchorMs(null);
      }
    }
    
    if (event.type === 'agent_initialized') {
      addLog('agent', `Agent initialized: ${event.agentName}`, { agentName: event.agentName });
    }
    
    if (event.type === 'agent_handoff') {
      currentAgentRef.current = event.to;
      addLog('success', `✅ Agent Handoff: ${event.from} → ${event.to}`, { from: event.from, to: event.to });
    }
    
    if (event.type === 'tool_execution_error') {
      addLog('error', `Tool Error: ${event.toolName} - ${event.error}`, event);
    }

    if (event.type === 'agent_tool_request' && event.tool_name) {
      addLog('tool', `🧰 Agent requested tool: ${event.tool_name}`, event);
    }
    if (event.type === 'agent_tool_response' && event.tool_name) {
      const status = event.is_error ? 'error' : event.is_called ? 'called' : 'not called';
      const logType = event.is_error ? 'error' : 'tool';
      addLog(logType, `🧰 Agent tool response: ${event.tool_name} (${status})`, event);
    }
    if (event.type === 'agent_tool_response' && event.tool_name === 'transfer_to_agent') {
      addLog('agent', `🔄 Agent Transfer: transfer_to_agent executed`, event);
    }
    
    if (event.type === 'handoff_attempt') {
      addLog('info', `🔍 Checking Handoff: Current="${event.currentAgent}", Last Tool="${event.lastTool || 'none'}"`, event);
    }
    
    if (event.type === 'conversation_complete') {
      addLog('success', `🎉 ${event.message}`, event);
      addLog('info', 'Session will automatically disconnect once audio finishes...', {});
    }

    if (event.type === 'status_change') {
      addLog('info', `📊 Status change: ${JSON.stringify(event)}`, event);
    }
    if (event.type === 'mode_change') {
      addLog('info', `🔊 Mode: ${event.mode}`, event);
    }
    if (event.type === 'can_send_feedback_change') {
      addLog('info', `📋 Can send feedback: ${JSON.stringify(event)}`, event);
    }

    if (typeof event.type === 'string' && event.type.startsWith('debug_')) {
      const debugType = event.type.replace('debug_', '');

      let logType: 'info' | 'agent' | 'tool' | 'error' | 'event' = 'info';
      let icon = '🔍';

      if (debugType.includes('workflow') || debugType.includes('route') || debugType.includes('transition') || debugType.includes('node') || debugType.includes('agent') || debugType.includes('handoff') || debugType.includes('transfer')) {
        logType = 'agent';
        icon = '🔄';
      } else if (debugType.includes('tool')) {
        logType = 'tool';
        icon = '🧰';
      } else if (debugType === 'parsing_error' || debugType.includes('error')) {
        logType = 'error';
        icon = '🔴';
      } else if (debugType === 'conversation_metadata' || debugType === 'config' || debugType === 'conversation_initiation_metadata' || debugType === 'conversation_initiation_client_data') {
        icon = '⚙️';
      } else if (debugType === 'audio_element_ready') {
        icon = '🔈';
      }

      let message = `${icon} [${debugType}]`;
      if (event.message) {
        const msgStr = typeof event.message === 'string' ? event.message : JSON.stringify(event.message);
        message += `: ${msgStr.substring(0, 200)}`;
      }

      addLog(logType, message, event);
    }
    
    if (event.type === 'interruption') {
      addLog('info', `⚡ Interruption event (id: ${event.event_id})`, event);
    }

    if (event.type === 'substance_selected' || 
        event.type === 'motivation_logged' || 
        event.type === 'goal_logged' ||
        event.type === 'drink_logged' ||
        event.type === 'baseline_calculated') {
      addLog('event', `Event: ${event.type}`, event);
      triggerEventUI(event.type, event);
    }

    const knownTypes = new Set([
      'agent_initialized', 'agent_handoff', 'tool_execution_error',
      'agent_tool_request', 'agent_tool_response', 'handoff_attempt',
      'conversation_complete', 'status_change', 'mode_change',
      'can_send_feedback_change', 'interruption',
      'substance_selected', 'motivation_logged', 'goal_logged',
      'drink_logged', 'baseline_calculated',
      'unhandled_client_tool_call',
    ]);
    const eventType = event.type || 'unknown';
    const isDebug = typeof eventType === 'string' && eventType.startsWith('debug_');
    const isTranscriptMessage = event.source === 'user' || event.source === 'ai';
    if (!knownTypes.has(eventType) && !isDebug && !isTranscriptMessage) {
      const summary = event.message
        ? (typeof event.message === 'string' ? event.message.substring(0, 200) : JSON.stringify(event.message).substring(0, 200))
        : '';
      addLog('info', `📡 SDK event [${eventType}]${summary ? ': ' + summary : ''}`, event);
    }
  };

  const {
    connect: connectAzure,
    disconnect: disconnectAzure,
    sendMessage: _sendMessageAzure,
    setMicMuted: setMicMutedAzure,
  } = useAzureWebRTCSession({
    customPrompts, // Pass custom prompts to the hook
    onConnectionChange: (s) => {
      if (currentProviderRef.current !== 'azure') return;
      setSessionStatus(s as SessionStatus);
      if (s === 'CONNECTING') {
        setActiveSpeaker('none');
        setMemberAudioLevel(0);
        applyModuleStateUpdates({ agentIsSpeaking: false, agentSpeechMode: 'connecting' });
        addLog('info', 'Connecting to Azure OpenAI...');
      } else if (s === 'CONNECTED') {
        setActiveSpeaker('member');
        applyModuleStateUpdates({ agentIsSpeaking: false, agentSpeechMode: 'listening' });
        addLog('success', 'Connected to Azure OpenAI WebRTC');
        setIsTransitioningJourney(false);
        setLoadingJourneyId(null);
      } else if (s === 'DISCONNECTED') {
        setActiveSpeaker('none');
        setMemberAudioLevel(0);
        applyModuleStateUpdates({ agentIsSpeaking: false, agentSpeechMode: 'disconnected' });
        addLog('info', 'Disconnected from Azure OpenAI');
        setIsTransitioningJourney(false);
        setLoadingJourneyId(null);
      }
    },
    onTranscript: (role: string, text: string, isDone?: boolean) => {
      const roleKey = role as 'user' | 'assistant';
      const ensureMessageId = (): { id: string; isNew: boolean } => {
        const existingId = currentMessageIdsRef.current[roleKey];
        if (existingId) return { id: existingId, isNew: false };
        const newId = `msg_${role}_${Date.now()}`;
        currentMessageIdsRef.current[roleKey] = newId;
        addTranscriptMessage(newId, roleKey, text, false);
        return { id: newId, isNew: true };
      };

      // Log transcripts
      if (role === 'user') {
        const { id: messageId, isNew } = ensureMessageId();
        if (isNew) {
          setAgentSpeechAlignment(null);
          agentSpeechPlaybackAnchorRef.current = null;
          setAgentSpeechPlaybackAnchorMs(null);
        }
        // Mark that the user has started speaking on this screen
        const activeScreenId = currentScreenIdRef.current;
        if (activeScreenId && text.trim()) {
          userHasSpokenOnScreenRef.current.add(activeScreenId);
        }
        // Accumulate user message text
        userMessageBuffer.current += text;
        // Only append if not a new message (new messages already have the text)
        if (messageId && text && !isNew) {
          updateTranscriptMessage(messageId, text, true);
        }
        if (isDone) {
          shouldResetLiveAgentMessageOnNextAssistantTextRef.current = true;
          clearLiveAgentMessage();
          setAgentSpeechAlignment(null);
          agentSpeechPlaybackAnchorRef.current = null;
          setAgentSpeechPlaybackAnchorMs(null);
          const fullUserText = userMessageBuffer.current.trim();
          if (fullUserText) {
            userUtteranceCountRef.current += 1;
            const activeScreenId = currentScreenIdRef.current;
            if (activeScreenId) {
              userUtterancesByScreenRef.current[activeScreenId] =
                (userUtterancesByScreenRef.current[activeScreenId] || 0) + 1;
            }
          }
          updateTranscriptItem(messageId, { status: 'DONE' });
          currentMessageIdsRef.current.user = undefined;
          // Queue completed user message for real-time saving (supports anonymous sessions)
          // Construct the complete TranscriptItem directly instead of looking up from state
          if (messageId && !queuedItemIdsRef.current.has(messageId)) {
            queuedItemIdsRef.current.add(messageId);
            const completeUserMessage: TranscriptItem = {
              itemId: messageId,
              type: 'MESSAGE',
              role: 'user',
              title: fullUserText,
              expanded: false,
              timestamp: new Date().toISOString(),
              createdAtMs: Date.now(),
              status: 'DONE',
              isHidden: false,
            };
            sessionSaverRef.current.queueMessage(completeUserMessage);
          }
          // Reset user message buffer
          userMessageBuffer.current = '';
        }
        addLog('info', `User: ${text}`);
      } else {
        // Accumulate assistant response tokens
        if (!assistantResponseStartTime.current) {
          assistantResponseStartTime.current = new Date();
          shouldResetLiveAgentMessageOnNextAssistantTextRef.current = true;
          // Don't set speaking state here - let audio element events handle it
        }
        assistantResponseBuffer.current += text;
        if (assistantResponseBuffer.current) {
          updateLiveAgentMessage(assistantResponseBuffer.current);
        }
        const { id: messageId, isNew } = ensureMessageId();
        // Only append if not a new message (new messages already have the text)
        if (messageId && text && !isNew) {
          updateTranscriptMessage(messageId, text, true);
        }
        
        // Only log when response is complete
        if (isDone) {
          const fullResponse = stripSpeechDirectives(assistantResponseBuffer.current.trim());
          if (fullResponse) {
            updateLiveAgentMessage(fullResponse);
            addLog('info', `Assistant: ${fullResponse}`);
            
            // Persona will naturally hear agent via microphone - no manual routing needed
          }
          // Mark message complete + reset buffer
          updateTranscriptItem(messageId, { status: 'DONE', title: fullResponse || undefined });
          currentMessageIdsRef.current.assistant = undefined;
          // Queue completed assistant message for real-time saving (supports anonymous sessions)
          // Construct the complete TranscriptItem directly instead of looking up from state
          if (messageId && !queuedItemIdsRef.current.has(messageId)) {
            queuedItemIdsRef.current.add(messageId);
            const completeAssistantMessage: TranscriptItem = {
              itemId: messageId,
              type: 'MESSAGE',
              role: 'assistant',
              title: fullResponse,
              expanded: false,
              timestamp: assistantResponseStartTime.current?.toISOString() || new Date().toISOString(),
              createdAtMs: assistantResponseStartTime.current?.getTime() || Date.now(),
              status: 'DONE',
              isHidden: false,
            };
            sessionSaverRef.current.queueMessage(completeAssistantMessage);
          }
          assistantResponseBuffer.current = '';
          assistantResponseStartTime.current = null;
          // Don't set speaking to false here - let audio element events handle it
          // This way the orb stays "speaking" until audio actually finishes playing
        }
      }
    },
    onEvent: handleVoiceEvent,
    onToolCall: (toolName, args, result) => {
      // Check if result contains an internal error (for session log display only)
      const resultObject = result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : null;
      const isError =
        (typeof result === 'string' && result.includes('[INTERNAL ERROR:')) ||
        (resultObject?.saved === false) ||
        (resultObject?.error === true);
      const logType = isError ? 'error' : 'tool';
      
      addLog(logType, `Tool executed: ${toolName}`, { args, result });
      logServerEvent({
        type: 'client_tool_call',
        tool_name: toolName,
        parameters: args || {},
        result: resultObject || result,
        is_error: isError,
      });
      
      // Handle record_input tool specifically - update screen state
      if (toolName === 'record_input' && args.title) {
        const activeScreenId = currentScreenIdRef.current;
        const savedFromResult = resultObject?.saved;
        const recordInputAccepted =
          savedFromResult === true ||
          (savedFromResult === undefined && !(typeof result === 'string' && /error/i.test(result)));

        if (!recordInputAccepted) {
          addLog('warning', `⚠️ Ignoring record_input callback payload on "${activeScreenId ?? 'unknown'}"`, {
            currentScreen: activeScreenId,
            savedFromResult,
            args,
            result: resultObject || result,
          });
          return;
        }

        const title = typeof resultObject?.title === 'string' ? resultObject.title : args.title;
        const summary = typeof resultObject?.summary === 'string' ? resultObject.summary : (args.summary || '');
        const description = typeof resultObject?.description === 'string' ? resultObject.description : (args.description || '');
        const storeKey = typeof resultObject?.storeKey === 'string' ? resultObject.storeKey : args.storeKey;
        const baseUpdates = deriveRecordInputModuleUpdates({ title, summary, storeKey });
        const { summary: displaySummary, updates: canonicalUpdates } = applyWeeklyFocusRecordInputPolicy(
          { title, summary, storeKey },
          baseUpdates,
          moduleStateRef.current
        );
        lastRecordInputRef.current = {
          atMs: Date.now(),
          title: String(title),
          summary: displaySummary,
        };
        addLog('info', `📝 Recording input - Title: ${title}, Summary: ${displaySummary}`);
        
        // Dispatch a custom event that ScreenProvider can listen to
        // This will update the screen state with the recorded input
        const event = new CustomEvent('recordInput', {
          detail: {
            title,
            summary: displaySummary,
            description,
            timestamp: Date.now(),
            storeKey,
          },
        });
        window.dispatchEvent(event);
        
        // Also update persistent module state in AgentUIContext to ensure summary cards render.
        if (Object.keys(canonicalUpdates).length > 0) {
          markCapturedModuleKeys(canonicalUpdates);
          applyModuleStateUpdates(canonicalUpdates);
          addLog('info', `✅ Updated persistent module state`, { keys: Object.keys(canonicalUpdates) });
        }
        
        addLog('info', `✅ Recorded input dispatched to screen state`);
      }
      
      // Handle end_call tool - disconnect and show feedback modal
      if (toolName === 'end_call') {
        addLog('info', `📞 End call requested${args.reason ? `: ${args.reason}` : ''}`);
        // Use setTimeout to allow the tool response to be sent before disconnecting
        // Pass true to force show feedback form (same behavior as user tapping end call)
        setTimeout(() => {
          disconnectFromRealtime(true);
        }, 500);
      }
      
      // Trigger UI card for this function call with current agent context
      triggerFunctionUI(toolName, args, currentAgentRef.current);
    },
    onAgentHandoff: (from, to) => {
      currentAgentRef.current = to;
      addLog('agent', `Agent handoff complete: ${from} → ${to}`, { from, to });
      
      // Update screen rendering if new agent has different screens
      if (currentJourney) {
        const newAgentConfig = currentJourney.agents.find(a => {
          const agentName = a.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
          return agentName === to;
        });
        
        if (newAgentConfig?.screens && newAgentConfig.screens.length > 0) {
          addLog('info', `📱 Switching to ${to}'s screens (${newAgentConfig.screens.length} screens)`);
          enableScreenRendering?.(newAgentConfig.screens, newAgentConfig.screens[0].id);
        }
      }
    },
    onConversationComplete: () => {
      // This callback is triggered when the conversation naturally ends
      // Disconnect both agent and persona (if active)
      console.log('🎬 Conversation complete - disconnecting all sessions');
      disconnectFromRealtime();

      // Handle Prolific completion if this is an external research journey
      const journey = currentJourneyRef.current;
      if (journey?.research?.isExternal && journey?.research?.prolific?.enabled) {
        const prolificSession = getProlificSession();
        if (prolificSession) {
          const outcome = prolificOutcomeRef.current;
          console.log(`📊 [Prolific] Handling ${outcome} for participant:`, prolificSession.params.prolificPid);
          addLog('info', `📊 Redirecting to Prolific (${outcome})...`);
          handleProlificCompletion({
            outcome,
            completionCode: journey.research.prolific.completionCode,
            screenOutCode: journey.research.prolific.screenOutCode,
          });
          // Reset outcome for next session
          prolificOutcomeRef.current = 'completed';
        }
      }
    },
  });

  const getActiveAgentScreens = useCallback((): AgentScreen[] => {
    const journey = currentJourneyRef.current;
    if (!journey?.agents?.length) return [];
    const runtimeAgentName = currentAgentRef.current;
    const activeAgent =
      journey.agents.find((agent) => normalizeAgentNameForRuntime(agent.name) === runtimeAgentName) ||
      journey.agents.find((agent) => agent.id === journey.startingAgentId) ||
      journey.agents[0];
    return ((activeAgent?.screens || []) as AgentScreen[]);
  }, []);

  const getActiveScreenContext = useCallback(() => {
    const activeScreenId = currentScreenIdRef.current || undefined;
    const activeScreens = getActiveAgentScreens();
    const activeScreen = activeScreens.find((screen) => screen.id === activeScreenId);
    const activeScreenEvents = getScreenEvents(activeScreen);
    return { activeScreenId, activeScreens, activeScreen, activeScreenEvents };
  }, [getActiveAgentScreens]);

  const triggerNavigationFromCurrentScreen = useCallback((preferredEventIds: string[] = []): boolean => {
    const { activeScreen, activeScreenEvents } = getActiveScreenContext();
    if (!activeScreen) return false;

    const navigationEvents = activeScreenEvents.filter((event) => {
      const navigationTargets = collectNavigationTargetsFromEvent(event);
      return (typeof event.id === 'string' && event.id.startsWith('navigate_')) || navigationTargets.length > 0;
    });
    if (navigationEvents.length === 0) return false;

    const preferredMatch = preferredEventIds
      .map((eventId) => navigationEvents.find((event) => event.id === eventId))
      .find((event): event is AgentScreenEvent => Boolean(event));
    const selectedEvent = preferredMatch || (navigationEvents.length === 1 ? navigationEvents[0] : null);
    if (!selectedEvent?.id) return false;

    window.dispatchEvent(new CustomEvent('triggerEvent', {
      detail: {
        eventId: selectedEvent.id,
        timestamp: Date.now(),
        source: 'runtime_navigation_assist',
      },
    }));
    return true;
  }, [getActiveScreenContext]);

  const directNavigateFromCurrentScreen = useCallback((preferredEventIds: string[] = []): boolean => {
    const { activeScreen, activeScreenEvents } = getActiveScreenContext();
    if (!activeScreen) return false;

    const navigationEvents = activeScreenEvents.filter((event) => {
      const navigationTargets = collectNavigationTargetsFromEvent(event);
      return (typeof event.id === 'string' && event.id.startsWith('navigate_')) || navigationTargets.length > 0;
    });
    if (navigationEvents.length === 0) return false;

    const preferredMatch = preferredEventIds
      .map((eventId) => navigationEvents.find((event) => event.id === eventId))
      .find((event): event is AgentScreenEvent => Boolean(event));
    const selectedEvent = preferredMatch || (navigationEvents.length === 1 ? navigationEvents[0] : null);
    const targetScreenId = collectNavigationTargetsFromEvent(selectedEvent)[0];
    if (!selectedEvent?.id || !targetScreenId || !navigateToScreen) return false;

    navigateToScreen(targetScreenId);
    const screenPointerUpdates = {
      currentScreen: targetScreenId,
      current_screen: targetScreenId,
    };
    applyModuleStateUpdates(screenPointerUpdates);
    updateFlowContext?.(screenPointerUpdates);
    addLog('info', `🧭 Direct navigation fallback: "${activeScreen.id}" → "${targetScreenId}" via "${selectedEvent.id}"`);
    return true;
  }, [addLog, applyModuleStateUpdates, getActiveScreenContext, navigateToScreen, updateFlowContext]);

  // Architecture rule reminder (see CLAUDE.md):
  // keep this runtime/tooling layer flow-agnostic; put flow-specific behavior in journey configs/prompts.
  // Define ElevenLabs client tools at component level for SDK initialization
  // These tools call through refs to avoid stale closures and circular dependencies
  // The actual implementations are updated via refs when they're available
  const elevenLabsClientTools = React.useMemo(() => ({
    // Trigger an event (e.g., navigate to next screen, trigger UI action)
    // This is the primary navigation tool used by the agent prompt
    // Supports optional delay in seconds before triggering
    trigger_event: async (params: { eventId: string; delay?: number | string }) => {
      const startedAtMs = Date.now();
      const { eventId, delay = 0 } = params;
      const parseDelaySeconds = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return Math.max(0, value);
        }
        if (typeof value === 'string') {
          const parsed = Number(value.trim());
          return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        }
        return 0;
      };
      let resolvedDelay = parseDelaySeconds(delay);
      addLog('tool', `🧰 trigger_event called: ${eventId}`, {
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        requestedDelaySeconds: delay,
      });
      const buildNavigationResult = (payload: {
        success: boolean;
        eventId: string;
        fromScreen?: string;
        nextScreen?: string;
        currentScreen?: string;
        delaySeconds?: number;
        reason?: string;
        message: string;
        availableEvents?: string[];
      }) => {
        const completedAtMs = Date.now();
        addLog('tool', `🧰 trigger_event result: ${payload.reason ?? (payload.success ? 'ok' : 'failed')}`, {
          eventId: payload.eventId,
          success: payload.success,
          currentScreen: payload.currentScreen ?? payload.fromScreen ?? currentScreenIdRef.current,
          fromScreen: payload.fromScreen ?? null,
          nextScreen: payload.nextScreen ?? null,
          startedAtMs,
          completedAtMs,
          elapsedMs: completedAtMs - startedAtMs,
          delaySeconds: payload.delaySeconds ?? resolvedDelay,
        });
        return {
          success: payload.success,
          event_id: payload.eventId,
          from_screen: payload.fromScreen ?? null,
          next_screen: payload.nextScreen ?? null,
          current_screen: payload.currentScreen ?? payload.fromScreen ?? null,
          delay_seconds: payload.delaySeconds ?? 0,
          reason: payload.reason ?? null,
          message: payload.message,
          available_events: payload.availableEvents ?? [],
        };
      };

      const dispatchTriggerEvent = (id: string, delaySeconds = 0, extra: Record<string, any> = {}) => {
        const trigger = () => {
          window.dispatchEvent(new CustomEvent('triggerEvent', {
            detail: { eventId: id, timestamp: Date.now(), ...extra }
          }));
        };
        if (delaySeconds > 0) {
          setTimeout(trigger, delaySeconds * 1000);
        } else {
          trigger();
        }
      };

      const isNavigationScreenEvent = (event: AgentScreenEvent | undefined): boolean => {
        if (!event) return false;
        if (typeof event.id === 'string' && event.id.startsWith('navigate_')) return true;
        return collectNavigationTargetsFromEvent(event).length > 0;
      };

      const getNavigationTargetFromEvent = (event: AgentScreenEvent | undefined): string | undefined => {
        return collectNavigationTargetsFromEvent(event)[0];
      };

      const activeScreenId = currentScreenIdRef.current || undefined;
      const { activeScreenEvents } = getActiveScreenContext();
      const requestedEventConfig = activeScreenEvents.find((event) => event.id === eventId);
      const isNavigationEvent = eventId.startsWith('navigate_') || isNavigationScreenEvent(requestedEventConfig);
      const navigationTarget = getNavigationTargetFromEvent(requestedEventConfig);
      const isSelectionEvent = eventId.startsWith('select_');

      if (isNavigationEvent && lastRecordInputRef.current) {
        const elapsedMs = Date.now() - lastRecordInputRef.current.atMs;
        if (elapsedMs >= 0 && elapsedMs <= RECENT_RECORD_INPUT_WINDOW_MS) {
          const remainingHoldMs = RECORD_INPUT_DISPLAY_MS - elapsedMs;
          if (remainingHoldMs > 0) {
            const minimumDelaySeconds = Number((remainingHoldMs / 1000).toFixed(1));
            if (resolvedDelay < minimumDelaySeconds) {
              resolvedDelay = minimumDelaySeconds;
              addLog(
                'info',
                `⏳ Holding navigation "${eventId}" for ${minimumDelaySeconds}s so the recorded answer stays visible.`
              );
            }
          }
        }
      }

      addLog('tool', `⚡ trigger_event: ${eventId}${resolvedDelay ? ` (delay: ${resolvedDelay}s)` : ''}`);

      dispatchTriggerEvent(eventId, resolvedDelay);

      // Return a more informative result based on event type to guide the LLM
      if (isSelectionEvent) {
        return buildNavigationResult({
          success: true,
          eventId,
          fromScreen: activeScreenId,
          currentScreen: activeScreenId,
          reason: 'selection_saved',
          message: `Selection "${eventId}" saved successfully. Do NOT repeat this call. Proceed to the next action (navigation).`,
        });
      }
      if (isNavigationEvent) {
        return buildNavigationResult({
          success: true,
          eventId,
          fromScreen: activeScreenId,
          nextScreen: navigationTarget,
          currentScreen: activeScreenId,
          delaySeconds: resolvedDelay,
          reason: 'navigation_scheduled',
          message: `Navigation "${eventId}" was triggered. Wait for the UI to confirm the new screen before asking that screen's question.`,
        });
      }
      return buildNavigationResult({
        success: true,
        eventId,
        fromScreen: activeScreenId,
        currentScreen: activeScreenId,
        delaySeconds: resolvedDelay,
        reason: 'event_triggered',
        message: `Event "${eventId}" triggered successfully.${resolvedDelay ? ` (after ${resolvedDelay}s delay)` : ''} Proceed to the next step.`,
      });
    },

    // Navigate directly by target screen id.
    // This resolves the matching navigation event on the CURRENT screen, then triggers it.
    navigate_to: async (params: { screen?: string; screen_id?: string; delay?: number | string }) => {
      const startedAtMs = Date.now();
      const targetScreen = params?.screen ?? params?.screen_id;
      const { delay = 0 } = params ?? {};
      const parseDelaySeconds = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return Math.max(0, value);
        }
        if (typeof value === 'string') {
          const parsed = Number(value.trim());
          return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        }
        return 0;
      };
      let resolvedDelay = parseDelaySeconds(delay);
      const activeScreenId = currentScreenIdRef.current || undefined;
      addLog('tool', `🧰 navigate_to called: ${targetScreen ?? 'missing_screen'}`, {
        currentScreen: activeScreenId,
        startedAtMs,
        requestedDelaySeconds: delay,
      });

      const buildResult = (payload: {
        success: boolean;
        eventId?: string;
        fromScreen?: string;
        nextScreen?: string;
        currentScreen?: string;
        delaySeconds?: number;
        reason?: string;
        message: string;
        availableNextScreens?: string[];
      }) => {
        const completedAtMs = Date.now();
        addLog('tool', `🧰 navigate_to result: ${payload.reason ?? (payload.success ? 'ok' : 'failed')}`, {
          screen: targetScreen ?? null,
          eventId: payload.eventId ?? null,
          success: payload.success,
          currentScreen: payload.currentScreen ?? payload.fromScreen ?? activeScreenId,
          fromScreen: payload.fromScreen ?? null,
          nextScreen: payload.nextScreen ?? null,
          availableNextScreens: payload.availableNextScreens ?? [],
          startedAtMs,
          completedAtMs,
          elapsedMs: completedAtMs - startedAtMs,
          delaySeconds: payload.delaySeconds ?? resolvedDelay,
        });
        return {
          success: payload.success,
          event_id: payload.eventId ?? null,
          from_screen: payload.fromScreen ?? null,
          next_screen: payload.nextScreen ?? null,
          current_screen: payload.currentScreen ?? payload.fromScreen ?? null,
          delay_seconds: payload.delaySeconds ?? 0,
          reason: payload.reason ?? null,
          message: payload.message,
          available_next_screens: payload.availableNextScreens ?? [],
        };
      };

      if (!targetScreen || typeof targetScreen !== 'string') {
        return buildResult({
          success: false,
          fromScreen: activeScreenId,
          currentScreen: activeScreenId,
          nextScreen: undefined,
          reason: 'missing_screen',
          message: 'Missing required "screen" parameter.',
        });
      }

      const dispatchTriggerEvent = (id: string, delaySeconds = 0) => {
        const trigger = () => {
          window.dispatchEvent(new CustomEvent('triggerEvent', {
            detail: { eventId: id, timestamp: Date.now() }
          }));
        };
        if (delaySeconds > 0) {
          setTimeout(trigger, delaySeconds * 1000);
        } else {
          trigger();
        }
      };

      const getNavigationTargetFromEvent = (event: AgentScreenEvent | undefined): string | undefined =>
        collectNavigationTargetsFromEvent(event)[0];

      const { activeScreen, activeScreenEvents } = getActiveScreenContext();

      const pendingNavigation = pendingNavigationRef.current;
      if (pendingNavigation && Date.now() <= pendingNavigation.expiresAtMs) {
        if (pendingNavigation.targetScreenId === targetScreen) {
          const remainingDelaySeconds = Math.max(0, Number(((pendingNavigation.executeAtMs - Date.now()) / 1000).toFixed(1)));
          return buildResult({
            success: true,
            eventId: pendingNavigation.eventId,
            fromScreen: activeScreenId,
            nextScreen: targetScreen,
            currentScreen: activeScreenId,
            delaySeconds: remainingDelaySeconds,
            reason: 'navigation_in_progress',
            message: `Navigation to "${targetScreen}" is already in progress${remainingDelaySeconds > 0 ? ` (about ${remainingDelaySeconds}s remaining)` : ''}.`,
          });
        }

        if (pendingNavigation.targetScreenId && pendingNavigation.targetScreenId !== targetScreen) {
          return buildResult({
            success: false,
            eventId: pendingNavigation.eventId,
            fromScreen: activeScreenId,
            nextScreen: targetScreen,
            currentScreen: activeScreenId,
            delaySeconds: 0,
            reason: 'navigation_in_progress_to_different_screen',
            message: `Navigation to "${pendingNavigation.targetScreenId}" is still in progress. Wait for it to complete before navigating to "${targetScreen}".`,
          });
        }
      }

      if (!activeScreen) {
        return buildResult({
          success: false,
          fromScreen: activeScreenId,
          currentScreen: activeScreenId,
          nextScreen: targetScreen,
          reason: 'no_active_screen',
          message: `Cannot navigate to "${targetScreen}" because there is no active screen context.`,
        });
      }

      const screenEvents = activeScreenEvents;
      const navEvents = screenEvents.filter((event: any) => getNavigationTargetFromEvent(event));
      const matchingNavEvent = navEvents.find((event: any) => getNavigationTargetFromEvent(event) === targetScreen);
      const availableNextScreens = navEvents
        .map((event: any) => getNavigationTargetFromEvent(event))
        .filter((value: string | undefined): value is string => typeof value === 'string');

      // Idempotency guard:
      // If the model calls navigate_to for the screen we're already on
      // (for example, after a trigger_event-based navigation already completed),
      // return success instead of surfacing an invalid transition error.
      if (activeScreen.id === targetScreen) {
        return buildResult({
          success: true,
          fromScreen: activeScreen.id,
          nextScreen: activeScreen.id,
          currentScreen: activeScreen.id,
          delaySeconds: 0,
          reason: 'already_on_target_screen',
          message: `Already on "${targetScreen}". No additional navigation needed.`,
          availableNextScreens,
        });
      }

      if (!matchingNavEvent) {
        return buildResult({
          success: false,
          fromScreen: activeScreen.id,
          currentScreen: activeScreen.id,
          nextScreen: targetScreen,
          reason: 'invalid_transition_for_current_screen',
          message: `Cannot navigate to "${targetScreen}" from "${activeScreen.id}".`,
          availableNextScreens,
        });
      }

      // Preserve freshly captured responses on screen before navigating away.
      if (lastRecordInputRef.current) {
        const elapsedMs = Date.now() - lastRecordInputRef.current.atMs;
        if (elapsedMs >= 0 && elapsedMs <= RECENT_RECORD_INPUT_WINDOW_MS) {
          const remainingHoldMs = RECORD_INPUT_DISPLAY_MS - elapsedMs;
          if (remainingHoldMs > 0) {
            const minimumDelaySeconds = Number((remainingHoldMs / 1000).toFixed(1));
            if (resolvedDelay < minimumDelaySeconds) {
              resolvedDelay = minimumDelaySeconds;
              addLog(
                'info',
                `⏳ Holding navigate_to("${targetScreen}") for ${minimumDelaySeconds}s so the captured answer stays visible.`
              );
            }
          }
        }
      }

      const executeAtMs = Date.now() + resolvedDelay * 1000;
      pendingNavigationRef.current = {
        eventId: matchingNavEvent.id,
        executeAtMs,
        // Keep a short buffer after expected execution to absorb duplicate tool calls.
        expiresAtMs: executeAtMs + 2000,
        targetScreenId: targetScreen,
        source: 'navigate_to',
      };

      dispatchTriggerEvent(matchingNavEvent.id, resolvedDelay);
      return buildResult({
        success: true,
        eventId: matchingNavEvent.id,
        fromScreen: activeScreen.id,
        nextScreen: targetScreen,
        currentScreen: activeScreen.id,
        delaySeconds: resolvedDelay,
        reason: 'navigation_scheduled',
        message: `Navigation to "${targetScreen}" triggered via event "${matchingNavEvent.id}". Wait for the screen change before asking the next prompt.`,
        availableNextScreens,
      });
    },

    // Record user input to screen state immediately.
    // If nextEventId is a navigation event, keep the captured summary visible for exactly 3 seconds.
    record_input: async (params: {
      title: string;
      summary?: string;
      description?: string;
      storeKey?: string;
      nextEventId?: string;
      delay?: number;
    }) => {
      const startedAtMs = Date.now();
      const { title, summary = '', description = '', storeKey, nextEventId, delay = 0 } = params;
      const activeScreenId = currentScreenIdRef.current;

      // Guard: only allow record_input once we have local evidence that the
      // user actually spoke on this screen.
      const userHasSpokenLocally = activeScreenId
        ? userHasSpokenOnScreenRef.current.has(activeScreenId)
        : userUtteranceCountRef.current > 0;
      const canPersistCapture = userHasSpokenLocally;
      const effectiveNextEventId = canPersistCapture ? nextEventId : undefined;
      if (!canPersistCapture && nextEventId) {
        addLog('warning', `⚠️ record_input: suppressing nextEventId "${nextEventId}" on "${activeScreenId ?? 'unknown'}" (user has not spoken on this screen yet).`, {
          title, storeKey, nextEventId, currentScreen: activeScreenId, startedAtMs,
        });
      }
      if (!canPersistCapture) {
        addLog('warning', `⚠️ record_input: ignored for "${storeKey || title}" until a member answer is received on "${activeScreenId ?? 'unknown'}".`, {
          userHasSpokenLocally,
        });
        return `Skipped record_input for "${title}" because no user response was detected on this screen yet. Ask a follow-up and try again after the member answers.`;
      }

      const baseUpdates = deriveRecordInputModuleUpdates({ title, summary, storeKey });
      const { summary: displaySummary, updates: canonicalUpdates } = applyWeeklyFocusRecordInputPolicy(
        { title, summary, storeKey },
        baseUpdates,
        moduleStateRef.current
      );
      const recordedAtMs = Date.now();
      lastRecordInputRef.current = { atMs: recordedAtMs, title, summary: displaySummary };
      addLog('tool', `📝 record_input called: ${title}`, {
        summary: displaySummary,
        storeKey,
        nextEventId,
        delay,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
      });

      // Dispatch event for ScreenProvider
      window.dispatchEvent(new CustomEvent('recordInput', {
        detail: { title, summary: displaySummary, description, timestamp: recordedAtMs, storeKey }
      }));

      const moduleUpdates: Record<string, any> = {};
      if (Object.keys(canonicalUpdates).length > 0) {
        Object.assign(moduleUpdates, canonicalUpdates);
      }

      if (Object.keys(moduleUpdates).length > 0) {
        clearLiveAgentMessage();
        markCapturedModuleKeys(moduleUpdates);
        applyModuleStateUpdates(moduleUpdates);
      }

      let postRecordMessage: string | null = null;
      // Trigger next event after delay if specified
      if (effectiveNextEventId) {
        const requestedDelayMs = Math.max(0, (delay || 0) * 1000);
        const journey = currentJourneyRef.current;
        const runtimeAgentName = currentAgentRef.current;
        const activeAgent =
          journey?.agents?.find(a => normalizeAgentNameForRuntime(a.name) === runtimeAgentName) ||
          journey?.agents?.find(a => a.id === journey?.startingAgentId) ||
          journey?.agents?.[0];
        const activeScreen = activeAgent?.screens?.find((screen: any) => screen.id === currentScreenIdRef.current);
        const activeScreenEvents = [
          ...(activeScreen?.events || []),
          ...((activeScreen?.sections || []).flatMap((section: any) =>
            (section?.elements || []).flatMap((element: any) => element?.events || [])
          )),
        ];
        const nextEventConfig = activeScreenEvents.find((event: any) => event?.id === effectiveNextEventId);
        const isNavigationEvent = Boolean(
          nextEventConfig &&
          (nextEventConfig.action || []).some(
            (action: any) => action?.type === 'navigation' && typeof action?.deeplink === 'string'
          )
        );
        const targetScreenId = isNavigationEvent
          ? (nextEventConfig?.action || []).find(
              (action: any) => action?.type === 'navigation' && typeof action?.deeplink === 'string'
            )?.deeplink
          : undefined;
        // Keep behavior deterministic for spoken-answer screens:
        // capture immediately, then hold for 3 seconds before navigating.
        const delayMs = isNavigationEvent ? RECORD_INPUT_DISPLAY_MS : requestedDelayMs;
        const nowMs = recordedAtMs;
        const executeAtMs = nowMs + delayMs;
        if (isNavigationEvent) {
          addLog('info', `⏳ Holding "${effectiveNextEventId}" for 3s so the captured answer remains visible.`);
          postRecordMessage = `Recorded: ${title}. Navigation "${effectiveNextEventId}" is scheduled in 3 seconds. Do not ask the next screen question until navigation completes.`;
        } else if (delayMs > 0) {
          addLog('info', `⏳ Delaying "${effectiveNextEventId}" by ${Math.round(delayMs / 1000)}s.`);
          postRecordMessage = `Recorded: ${title}. Event "${effectiveNextEventId}" is scheduled in ${Math.round(delayMs / 1000)} seconds.`;
        } else {
          postRecordMessage = `Recorded: ${title}. Event "${effectiveNextEventId}" triggered.`;
        }
        pendingNavigationRef.current = {
          eventId: effectiveNextEventId,
          executeAtMs,
          // Keep a short buffer after execute time to absorb duplicate LLM calls.
          expiresAtMs: executeAtMs + 2000,
          targetScreenId,
          source: 'record_input',
        };

        const dispatchNavigation = () => {
          const pending = pendingNavigationRef.current;
          if (!pending || pending.eventId !== effectiveNextEventId || pending.executeAtMs !== executeAtMs) {
            return;
          }
          if (lastElevenLabsModeRef.current === 'speaking') {
            addLog('info', `⏳ Agent still speaking — deferring navigation "${effectiveNextEventId}" by 500ms`);
            setTimeout(dispatchNavigation, 500);
            return;
          }
          window.dispatchEvent(new CustomEvent('triggerEvent', {
            detail: { eventId: effectiveNextEventId, timestamp: Date.now() }
          }));
          setTimeout(() => {
            const active = pendingNavigationRef.current;
            if (active && active.eventId === effectiveNextEventId && active.executeAtMs === executeAtMs) {
              pendingNavigationRef.current = null;
            }
          }, 2000);
        };
        setTimeout(dispatchNavigation, delayMs);
      }

      const completedAtMs = Date.now();
      addLog('tool', `📝 record_input result: ${title}`, {
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        completedAtMs,
        elapsedMs: completedAtMs - startedAtMs,
        nextEventId: nextEventId || null,
        effectiveNextEventId: effectiveNextEventId || null,
        navigationSuppressed: !userHasSpokenLocally && !!nextEventId,
      });
      return {
        saved: true,
        title,
        summary: displaySummary,
        storeKey: storeKey || null,
        current_screen: activeScreenId || null,
        message: postRecordMessage ?? `Recorded: ${title}`,
      };
    },

    // Save structured goals with categories and progress tracking.
    // Accepts either the new structured format (array of {goal, categories, progress} objects)
    // or legacy format (array of strings) for backward compatibility.
    // Stores:
    //   goalTitles  – string[] for the checklistCard element (matches {$moduleData.goalTitles})
    //   memberGoals – full goal objects for backend/analytics
    set_goals: async (params: { goals?: any[] | string } | any[] | string) => {
      const startedAtMs = Date.now();
      const parseJsonIfPossible = (value: unknown): unknown => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return value;
        try {
          return JSON.parse(trimmed);
        } catch {
          return value;
        }
      };

      const toPreview = (value: unknown): string => {
        try {
          if (typeof value === 'string') return value.slice(0, 200);
          return JSON.stringify(value).slice(0, 200);
        } catch {
          return String(value).slice(0, 200);
        }
      };

      const normalizeCategories = (value: unknown): string[] => {
        const allowed = new Set([
          'health',
          'relationships',
          'emotional_wellbeing',
          'financial',
          'habits',
          'personal_growth',
          'mindfulness',
          'other',
        ]);

        const candidates = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? (() => {
                const parsed = parseJsonIfPossible(value);
                if (Array.isArray(parsed)) return parsed;
                return value.split(/[;,|]/);
              })()
            : [];

        const normalized: string[] = [];
        for (const entry of candidates) {
          if (typeof entry !== 'string') continue;
          const raw = entry.trim().toLowerCase();
          if (!raw) continue;
          const category = raw.replace(/\s+/g, '_');
          normalized.push(allowed.has(category) ? category : 'other');
        }
        return Array.from(new Set(normalized));
      };

      const normalizeGoalText = (value: unknown): string => {
        if (typeof value === 'string') return value.trim();
        if (!value || typeof value !== 'object') return '';

        const record = value as Record<string, unknown>;
        const nested =
          record.value ??
          record.text ??
          record.label ??
          record.goal;
        return typeof nested === 'string' ? nested.trim() : '';
      };

      const normalizeGoalsInput = (value: unknown): unknown => {
        let parsed = parseJsonIfPossible(value);
        if (!parsed || typeof parsed !== 'object') return parsed;
        if (Array.isArray(parsed)) return parsed;

        const record = parsed as Record<string, unknown>;
        if ('goals' in record) {
          return parseJsonIfPossible(record.goals);
        }

        // Accept objects keyed by numeric indices: {"0": {...}, "1": {...}}
        const keys = Object.keys(record);
        if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
          return keys
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => record[key]);
        }

        return parsed;
      };

      // Normalise into structured goal objects.
      interface GoalObject { goal: string; categories: string[]; progress: number; }
      const goalObjects: GoalObject[] = [];

      const pushGoalObject = (item: unknown) => {
        if (typeof item === 'string' && item.trim()) {
          goalObjects.push({ goal: item.trim(), categories: [], progress: 0 });
          return;
        }
        if (!item || typeof item !== 'object') return;

        const record = item as Record<string, unknown>;
        const goalText = normalizeGoalText(
          record.goal ?? record.title ?? record.name ?? record.outcome ?? record.text
        );
        if (!goalText) return;

        const progressValue =
          typeof record.progress === 'number'
            ? record.progress
            : typeof record.progress === 'string'
              ? Number(record.progress)
              : 0;
        const progress = Number.isFinite(progressValue)
          ? Math.max(0, Math.min(100, Math.round(progressValue)))
          : 0;

        goalObjects.push({
          goal: goalText,
          categories: normalizeCategories(record.categories),
          progress,
        });
      };

      let rawGoals: unknown = normalizeGoalsInput(params);
      if (
        rawGoals &&
        typeof rawGoals === 'object' &&
        !Array.isArray(rawGoals) &&
        'goals' in (rawGoals as Record<string, unknown>)
      ) {
        rawGoals = normalizeGoalsInput((rawGoals as Record<string, unknown>).goals);
      }

      if (Array.isArray(rawGoals)) {
        rawGoals.forEach(pushGoalObject);
      } else if (typeof rawGoals === 'string' && rawGoals.trim()) {
        const parsed = normalizeGoalsInput(rawGoals);
        if (Array.isArray(parsed)) {
          parsed.forEach(pushGoalObject);
        } else {
          rawGoals
            .split(/[;\n]/)
            .map((goal) => goal.trim())
            .filter(Boolean)
            .forEach((goal) => pushGoalObject(goal));
        }
      } else {
        pushGoalObject(rawGoals);
      }

      // Deduplicate by goal text (case-insensitive)
      const seen = new Set<string>();
      const uniqueGoals = goalObjects.filter(g => {
        const key = g.goal.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (uniqueGoals.length === 0) {
        addLog('warning', '⚠️ set_goals called without usable goals', {
          paramsPreview: toPreview(params),
        });
        return {
          saved: false,
          goals: [],
          message: 'No goals were saved. Provide goals as an array, JSON array string, or { goals: [...] }.',
        };
      }

      const goalTitles = uniqueGoals.map(g => g.goal);
      addLog('tool', `🎯 set_goals called`, {
        goalsCount: goalTitles.length,
        goalTitles,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
      });

      // Dispatch recordInput for logging/persistence
      window.dispatchEvent(new CustomEvent('recordInput', {
        detail: {
          title: 'Goals',
          summary: goalTitles.join('; '),
          description: `Captured ${uniqueGoals.length} goal(s)`,
          storeKey: 'goals',
          timestamp: Date.now(),
        }
      }));

      // Store both goalTitles (string[] for checklistCard) and memberGoals (full objects)
      // in module state — matches iOS stateManager.updateModuleState pattern
      const goalUpdates = {
        goalTitles,
        memberGoals: uniqueGoals,
      };
      markCapturedModuleKeys(goalUpdates);
      applyModuleStateUpdates(goalUpdates);

      const completedAtMs = Date.now();
      addLog('tool', `🎯 set_goals result`, {
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        completedAtMs,
        elapsedMs: completedAtMs - startedAtMs,
        goalsCount: uniqueGoals.length,
      });
      return {
        saved: true,
        goals: uniqueGoals,
        goalTitles,
        message: `Saved ${uniqueGoals.length} goal(s).`,
      };
    },

    // Capture the member's weekly focus and optionally link it to a goal.
    // Stores weeklyFocus, weeklyFocusGoal, and weeklyFocusCaption in module state.
    // The quoteCard element reads these via {$moduleData.weeklyFocus} and {$moduleData.weeklyFocusCaption}.
    capture_weekly_focus: async (params: { focus?: string; relatedGoal?: string } | string) => {
      const startedAtMs = Date.now();
      const parseJsonIfPossible = (value: unknown): unknown => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        if (!trimmed) return value;
        try {
          return JSON.parse(trimmed);
        } catch {
          return value;
        }
      };

      const toPreview = (value: unknown): string => {
        try {
          if (typeof value === 'string') return value.slice(0, 200);
          return JSON.stringify(value).slice(0, 200);
        } catch {
          return String(value).slice(0, 200);
        }
      };

      let payload: unknown = parseJsonIfPossible(params);
      if (typeof payload === 'string') {
        payload = { focus: payload };
      }

      const payloadObject = (payload && typeof payload === 'object' && !Array.isArray(payload))
        ? payload as Record<string, unknown>
        : {};

      const focus =
        (typeof payloadObject.focus === 'string' ? payloadObject.focus : '')
          .trim() ||
        (typeof payloadObject.weeklyFocus === 'string' ? payloadObject.weeklyFocus : '')
          .trim();
      if (!focus) {
        addLog('warning', '⚠️ capture_weekly_focus called without focus text', {
          paramsPreview: toPreview(params),
        });
        return { saved: false, message: 'No focus text provided.' };
      }

      const relatedGoal =
        (typeof payloadObject.relatedGoal === 'string' ? payloadObject.relatedGoal : '')
          .trim() ||
        (typeof payloadObject.related_goal === 'string' ? payloadObject.related_goal : '')
          .trim() ||
        null;

      // Generate date caption
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
      const caption = `– My focus set on ${dateStr}`;

      addLog('tool', `🎯 capture_weekly_focus called`, {
        focus,
        relatedGoal,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
      });

      // Store in module state — matches iOS stateManager.updateModuleState pattern
      const stateUpdates: Record<string, any> = {
        weeklyFocus: focus,
        weeklyIntention: focus,
        weeklyFocusCaption: caption,
      };
      if (relatedGoal) {
        stateUpdates.weeklyFocusGoal = relatedGoal;
      }

      markCapturedModuleKeys(stateUpdates);
      applyModuleStateUpdates(stateUpdates);

      // Keep captured focus visible briefly, then advance using the current screen's
      // single available navigation event (flow-agnostic behavior).
      const { activeScreen, activeScreenEvents } = getActiveScreenContext();
      const navigationEvents = activeScreenEvents.filter((event) =>
        (typeof event.id === 'string' && event.id.startsWith('navigate_')) ||
        collectNavigationTargetsFromEvent(event).length > 0
      );
      const autoNavigationEvent = navigationEvents.length === 1 ? navigationEvents[0] : null;
      const autoNavigationEventId = autoNavigationEvent?.id;
      const autoNavigationTarget = collectNavigationTargetsFromEvent(autoNavigationEvent)[0];

      if (activeScreen && autoNavigationEventId) {
        const delayMs = RECORD_INPUT_DISPLAY_MS;
        const executeAtMs = Date.now() + delayMs;
        pendingNavigationRef.current = {
          eventId: autoNavigationEventId,
          executeAtMs,
          expiresAtMs: executeAtMs + 2000,
          targetScreenId: autoNavigationTarget,
          source: 'capture_weekly_focus',
        };
        addLog('info', `⏳ Holding "${autoNavigationEventId}" for 3s so the captured focus card remains visible.`);

        const dispatchWeeklyFocusNavigation = () => {
          const pending = pendingNavigationRef.current;
          if (
            !pending ||
            pending.eventId !== autoNavigationEventId ||
            pending.executeAtMs !== executeAtMs
          ) {
            return;
          }
          if (lastElevenLabsModeRef.current === 'speaking') {
            addLog('info', `⏳ Agent still speaking — deferring navigation "${autoNavigationEventId}" by 500ms`);
            setTimeout(dispatchWeeklyFocusNavigation, 500);
            return;
          }
          window.dispatchEvent(new CustomEvent('triggerEvent', {
            detail: { eventId: autoNavigationEventId, timestamp: Date.now() },
          }));
          setTimeout(() => {
            const activePending = pendingNavigationRef.current;
            if (
              activePending &&
              activePending.eventId === autoNavigationEventId &&
              activePending.executeAtMs === executeAtMs
            ) {
              pendingNavigationRef.current = null;
            }
          }, 2000);
        };

        setTimeout(dispatchWeeklyFocusNavigation, delayMs);
      } else if (activeScreen) {
        addLog(
          'warning',
          `⚠️ capture_weekly_focus saved data on "${activeScreen.id}" but could not determine a single navigation event to auto-advance.`
        );
      }

      const completedAtMs = Date.now();
      addLog('tool', `🎯 capture_weekly_focus result`, {
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        completedAtMs,
        elapsedMs: completedAtMs - startedAtMs,
      });
      return {
        saved: true,
        weeklyFocus: focus,
        weeklyFocusCaption: caption,
        ...(relatedGoal ? { weeklyFocusGoal: relatedGoal } : {}),
        message: `Weekly focus saved: "${focus}"`,
      };
    },

    // End the call and show feedback
    // Supports delaySeconds for delayed disconnect
    end_call: async (params: { reason?: string; delaySeconds?: number }) => {
      const startedAtMs = Date.now();
      const delayMs = (params.delaySeconds || 0) * 1000 + 500; // Add 500ms base delay
      const completedAtMs = Date.now();
      addLog('tool', `📞 end_call`, {
        reason: params.reason || 'User requested',
        delayMs,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        completedAtMs,
        elapsedMs: completedAtMs - startedAtMs,
      });
      // Use ref to call the actual disconnect function (avoids circular dependency)
      setTimeout(() => disconnectFromRealtimeRef.current?.(true), delayMs);
      return 'Call ending';
    },

    // DEPRECATED: Check-in frequency is now saved automatically by the select_*_commitment events.
    // This handler remains supported for spoken-only capture and legacy agents.
    set_checkin_frequency: async (params: { days: number }) => {
      const startedAtMs = Date.now();
      const parsed = Number(params.days);
      if (!Number.isFinite(parsed)) {
        return {
          saved: false,
          message: 'Invalid frequency value. Please provide an integer number of days per week (1-7).',
        };
      }

      const days = Math.max(1, Math.min(7, Math.round(parsed)));
      const checkinCommitment = days >= 6 ? 'Every day' : days >= 3 ? 'A few times' : 'Once';

      addLog('tool', `📊 set_checkin_frequency called`, {
        days,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
      });

      window.dispatchEvent(new CustomEvent('recordInput', {
        detail: {
          title: 'Check-in commitment',
          summary: String(days),
          description: `${checkinCommitment} (${days} days per week)`,
          storeKey: 'checkinFrequencyDays',
          timestamp: Date.now(),
        }
      }));

      const checkinUpdates = {
        checkinFrequencyDays: days,
        checkinCommitment,
      };
      markCapturedModuleKeys(checkinUpdates);
      applyModuleStateUpdates(checkinUpdates);

      const completedAtMs = Date.now();
      addLog('tool', `📊 set_checkin_frequency result`, {
        days,
        checkinCommitment,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        completedAtMs,
        elapsedMs: completedAtMs - startedAtMs,
      });
      return {
        saved: true,
        checkinFrequencyDays: days,
        checkinCommitment,
        message: `Check-in frequency saved: ${days} days per week`,
      };
    },

    // Save preferred reminder time (converts to UTC)
    set_reminder_time: async (params: any) => {
      const startedAtMs = Date.now();
      try {
        const activeScreenId = currentScreenIdRef.current;

        // Defensive: extract time from various param shapes the LLM might send
        const userTime = typeof params === 'string' ? params
          : params?.time ?? params?.reminder_time ?? params?.reminderTime ?? String(params);
        
        addLog('tool', `⏰ set_reminder_time called`, {
          params,
          currentScreen: currentScreenIdRef.current,
          startedAtMs,
        });

        if (!userTime || userTime === 'undefined' || userTime === 'null') {
          addLog('tool', `⚠️ set_reminder_time: no valid time provided, params were: ${JSON.stringify(params)}`);
          return {
            saved: false,
            message: 'Error: no time value received. Please ask the user again for their preferred reminder time and call set_reminder_time with the time parameter.',
          };
        }

        const utcTime = parseLocalTimeToUTC(userTime);
        const validUtcTimePattern = /^\d{2}:\d{2}$/;
        if (!validUtcTimePattern.test(utcTime)) {
          addLog('warning', '⚠️ set_reminder_time: unable to parse a concrete time value', {
            userTime,
            utcTime,
            currentScreen: currentScreenIdRef.current,
          });
          return {
            saved: false,
            current_screen: activeScreenId ?? null,
            reason: 'invalid_time_value',
            message: `Could not parse "${userTime}" into a valid time. Ask for a specific time like "9 PM" or "8:30 AM".`,
          };
        }
        addLog('tool', `⏰ set_reminder_time parsed`, {
          userTime,
          utcTime,
          currentScreen: currentScreenIdRef.current,
        });

        // Dispatch event for ScreenProvider
        window.dispatchEvent(new CustomEvent('recordInput', {
          detail: { title: 'Reminder time', summary: utcTime, description: `User said: ${userTime}, UTC: ${utcTime}`, storeKey: 'reminderTime', timestamp: Date.now() }
        }));

        const reminderUpdates = {
          reminderTime: utcTime,
          notificationTime: utcTime,
        };
        markCapturedModuleKeys(reminderUpdates);
        applyModuleStateUpdates(reminderUpdates);

        const completedAtMs = Date.now();
        addLog('tool', `⏰ set_reminder_time result`, {
          currentScreen: currentScreenIdRef.current,
          startedAtMs,
          completedAtMs,
          elapsedMs: completedAtMs - startedAtMs,
          userTime,
          utcTime,
        });
        return {
          saved: true,
          notificationTimeLocal: userTime,
          notificationTimeUtc: utcTime,
          message: `Reminder time saved: ${userTime} (UTC: ${utcTime})`,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const completedAtMs = Date.now();
        addLog('tool', `❌ set_reminder_time error`, {
          errMsg,
          params,
          currentScreen: currentScreenIdRef.current,
          startedAtMs,
          completedAtMs,
          elapsedMs: completedAtMs - startedAtMs,
        });
        console.error('set_reminder_time handler error:', error, 'params:', params);
        return {
          saved: false,
          message: `Error saving reminder time: ${errMsg}. Please try again with a time like "9 PM" or "8 AM".`,
        };
      }
    },

    // Navigate to a specific screen
    navigate_to_screen: async (params: { screen_id: string }) => {
      const startedAtMs = Date.now();
      addLog('tool', `📱 navigate_to_screen called`, {
        screenId: params.screen_id,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
      });
      window.dispatchEvent(new CustomEvent('navigateToScreen', {
        detail: { screenId: params.screen_id }
      }));
      const completedAtMs = Date.now();
      addLog('tool', `📱 navigate_to_screen result`, {
        screenId: params.screen_id,
        currentScreen: currentScreenIdRef.current,
        startedAtMs,
        completedAtMs,
        elapsedMs: completedAtMs - startedAtMs,
      });
      return `Navigated to screen: ${params.screen_id}`;
    },

    // Switch to another agent
    switch_agent: async (params: { agent_id?: string; agent_name?: string }) => {
      const agentIdentifier = params.agent_id || params.agent_name;
      addLog('tool', `🔄 switch_agent: ${agentIdentifier}`);
      if (switchToAgent && agentIdentifier) {
        switchToAgent(agentIdentifier);
      }
      return `Switched to agent: ${agentIdentifier}`;
    },

    // Transfer to agent (alias for switch_agent)
    transfer_to_agent: async (params: { agent_id?: string; agent_name?: string }) => {
      const agentIdentifier = params.agent_id || params.agent_name;
      addLog('tool', `🔄 transfer_to_agent: ${agentIdentifier}`);
      if (switchToAgent && agentIdentifier) {
        switchToAgent(agentIdentifier);
      }
      return `Transferred to agent: ${agentIdentifier}`;
    },

    // Screen out a Prolific participant (ends call and redirects to screen-out URL)
    screen_out_participant: async (params: { reason?: string }) => {
      addLog('tool', `🚫 screen_out_participant: ${params.reason || 'Did not qualify'}`);
      // Store the outcome so we use the screen-out code on completion
      prolificOutcomeRef.current = 'screened_out';
      // End the call with a short delay
      setTimeout(() => disconnectFromRealtimeRef.current?.(true), 500);
      return 'Participant screened out';
    },
  }), [applyModuleStateUpdates, switchToAgent]); // addLog is stable (regular function)

  // ElevenLabs hook with same callbacks - pass clientTools at init time
  const {
    connect: connectElevenLabs,
    disconnect: disconnectElevenLabs,
    setMicMuted: setMicMutedElevenLabs,
    sendUserMessage: sendUserMessageElevenLabs,
    sendContextualUpdate: sendContextualUpdateElevenLabs,
    getOutputVolume: getElevenLabsOutputVolume,
  } = useElevenLabsSession({
    customPrompts,
    clientTools: elevenLabsClientTools,
    onConnectionChange: (s) => {
      if (currentProviderRef.current !== 'elevenlabs') return;
      setSessionStatus(s as SessionStatus);
      const timestamp = new Date().toLocaleTimeString();
      if (s === 'CONNECTING') {
        setActiveSpeaker('none');
        setMemberAudioLevel(0);
        setAgentSpeechAlignment(null);
        agentSpeechPlaybackAnchorRef.current = null;
        setAgentSpeechPlaybackAnchorMs(null);
        setAgentSpeechPlaybackMs(null);
        shouldResetLiveAgentMessageOnNextAssistantTextRef.current = false;
        lastElevenLabsModeRef.current = null;
        applyModuleStateUpdates({ agentIsSpeaking: false, agentSpeechMode: 'connecting' });
        addLog('info', `[${timestamp}] Connecting to ElevenLabs...`);
        setConnectionError(null); // Clear any previous errors
      } else if (s === 'CONNECTED') {
        setActiveSpeaker('member');
        setAgentSpeechPlaybackMs(0);
        lastElevenLabsModeRef.current = 'listening';
        applyModuleStateUpdates({ agentIsSpeaking: false, agentSpeechMode: 'listening' });
        addLog('success', `[${timestamp}] Connected to ElevenLabs`);
        setIsTransitioningJourney(false);
        setLoadingJourneyId(null);
        setConnectionError(null); // Clear any previous errors
      } else if (s === 'DISCONNECTED') {
        setActiveSpeaker('none');
        setMemberAudioLevel(0);
        setAgentSpeechAlignment(null);
        agentSpeechPlaybackAnchorRef.current = null;
        setAgentSpeechPlaybackAnchorMs(null);
        setAgentSpeechPlaybackMs(null);
        shouldResetLiveAgentMessageOnNextAssistantTextRef.current = false;
        lastElevenLabsModeRef.current = null;
        applyModuleStateUpdates({ agentIsSpeaking: false, agentSpeechMode: 'disconnected' });
        addLog('info', `[${timestamp}] Disconnected from ElevenLabs`);
        setIsTransitioningJourney(false);
        setLoadingJourneyId(null);
      }
    },
    onEvent: handleVoiceEvent,
    onModeChange: (mode) => {
      if (currentProviderRef.current !== 'elevenlabs') return;
      const previousMode = lastElevenLabsModeRef.current;
      const isNewSpeakingTurn = mode === 'speaking' && previousMode !== 'speaking';

      if (isNewSpeakingTurn) {
        setAgentSpeechAlignment(null);
        alignmentReceivedForTurnRef.current = false;
        pendingTranscriptTextRef.current = null;
        agentSpeechPlaybackAnchorRef.current = null;
        setAgentSpeechPlaybackAnchorMs(null);
        shouldResetLiveAgentMessageOnNextAssistantTextRef.current = true;
      }
      if (previousMode === 'speaking' && mode !== 'speaking') {
        const pendingText = pendingTranscriptTextRef.current;
        if (pendingText) {
          pendingTranscriptTextRef.current = null;
          updateLiveAgentMessageProgressively(pendingText);
        }
        alignmentReceivedForTurnRef.current = false;
      }
      lastElevenLabsModeRef.current = mode;
      setActiveSpeaker(mode === 'speaking' ? 'agent' : 'member');
      applyModuleStateUpdates({ agentIsSpeaking: mode === 'speaking', agentSpeechMode: mode });
      if (mode === 'speaking') {
        setMemberAudioLevel(0);
      }
    },
    onAudioAlignment: (alignment) => {
      if (currentProviderRef.current !== 'elevenlabs') return;
      if (lastElevenLabsModeRef.current !== 'speaking') return;
      alignmentReceivedForTurnRef.current = true;

      const currentPlaybackMs = audioElementRef.current
        ? Math.max(0, audioElementRef.current.currentTime * 1000)
        : null;
      if (currentPlaybackMs !== null) {
        setAgentSpeechPlaybackMs(currentPlaybackMs);
      }
      if (agentSpeechPlaybackAnchorRef.current === null && currentPlaybackMs !== null) {
        agentSpeechPlaybackAnchorRef.current = currentPlaybackMs;
        setAgentSpeechPlaybackAnchorMs(currentPlaybackMs);
      }

      setAgentSpeechAlignment({
        raw: alignment,
        receivedAtMs: Date.now(),
      });
      const alignmentText = extractAlignmentText(alignment);
      if (alignmentText !== null) {
        updateLiveAgentMessageProgressively(alignmentText);
      }
    },
    onVadScore: (vadScore) => {
      if (currentProviderRef.current !== 'elevenlabs') return;
      if (isMicMuted || activeSpeaker !== 'member') {
        setMemberAudioLevel(0);
        return;
      }

      // Use ElevenLabs real-time VAD score as the user speaking intensity signal.
      const boostedScore = Math.min(1, Math.pow(vadScore, 0.7) * 1.2);
      setMemberAudioLevel((previousLevel) => (previousLevel * 0.42) + (boostedScore * 0.58));
    },
    onTranscript: (role: string, text: string, isDone?: boolean) => {
      const normalizedText = typeof text === 'string' ? text : '';
      if (!normalizedText.trim()) return;
      const roleKey = role as 'user' | 'assistant';
      const messageId = `msg_${role}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      // Add message to transcript
      addTranscriptMessage(messageId, roleKey, normalizedText, false);
      
      // Mark as done since ElevenLabs sends complete messages
      if (isDone !== false) {
        updateTranscriptItem(messageId, { status: 'DONE' });
        
        // Queue for real-time saving (supports anonymous sessions)
        if (!queuedItemIdsRef.current.has(messageId)) {
          queuedItemIdsRef.current.add(messageId);
          const completeMessage: TranscriptItem = {
            itemId: messageId,
            type: 'MESSAGE',
            role: roleKey,
            title: normalizedText,
            expanded: false,
            timestamp: new Date().toISOString(),
            createdAtMs: Date.now(),
            status: 'DONE',
            isHidden: false,
          };
          sessionSaverRef.current.queueMessage(completeMessage);
        }
      }
      
      // Log message
      if (role === 'user') {
        const activeScreenId = currentScreenIdRef.current;
        if (activeScreenId && normalizedText.trim()) {
          userHasSpokenOnScreenRef.current.add(activeScreenId);
        }
        if (isDone !== false) {
          shouldResetLiveAgentMessageOnNextAssistantTextRef.current = true;
          clearLiveAgentMessage();
          setAgentSpeechAlignment(null);
          agentSpeechPlaybackAnchorRef.current = null;
          setAgentSpeechPlaybackAnchorMs(null);
          userUtteranceCountRef.current += 1;
          if (activeScreenId) {
            userUtterancesByScreenRef.current[activeScreenId] =
              (userUtterancesByScreenRef.current[activeScreenId] || 0) + 1;
          }
        }
        addLog('info', `User: ${normalizedText}`);
      } else {
        if (alignmentReceivedForTurnRef.current) {
          pendingTranscriptTextRef.current = normalizedText;
        } else {
          updateLiveAgentMessageProgressively(normalizedText);
        }
        addLog('info', `Assistant: ${normalizedText}`);
      }
    },
    onConversationComplete: () => {
      console.log('🎬 ElevenLabs conversation complete');
      disconnectFromRealtime();

      // Handle Prolific completion if this is an external research journey
      const journey = currentJourneyRef.current;
      if (journey?.research?.isExternal && journey?.research?.prolific?.enabled) {
        const prolificSession = getProlificSession();
        if (prolificSession) {
          const outcome = prolificOutcomeRef.current;
          console.log(`📊 [Prolific] Handling ${outcome} for participant:`, prolificSession.params.prolificPid);
          addLog('info', `📊 Redirecting to Prolific (${outcome})...`);
          handleProlificCompletion({
            outcome,
            completionCode: journey.research.prolific.completionCode,
            screenOutCode: journey.research.prolific.screenOutCode,
          });
          // Reset outcome for next session
          prolificOutcomeRef.current = 'completed';
        }
      }
    },
    onError: (errorMessage, details) => {
      const timestamp = new Date().toLocaleTimeString();
      console.error('🔴 ElevenLabs Error:', errorMessage, details);
      
      // Don't show error modal for debug messages or normal disconnects
      const isDebugMessage = errorMessage.startsWith('DEBUG:');
      const isNormalDisconnect = errorMessage.includes('Disconnected (user)') || 
                                  errorMessage.includes('Disconnected (agent)');
      const isToolRoutingIssue = errorMessage.startsWith('Unhandled client tool call:');
      
      if (isDebugMessage) {
        addLog('info', `[${timestamp}] ${errorMessage}`);
      } else if (isNormalDisconnect) {
        addLog('info', `[${timestamp}] Session ended normally`);
      } else if (isToolRoutingIssue) {
        addLog('warning', `[${timestamp}] ${errorMessage}`);
      } else {
        addLog('error', `[${timestamp}] ElevenLabs Error: ${errorMessage}`);
        if (details?.name) {
          addLog('error', `[${timestamp}] Error type: ${details.name}`);
        }
        if (details?.stack) {
          addLog('error', `[${timestamp}] Stack: ${details.stack.substring(0, 200)}...`);
        }
        // Only show error modal for actual errors
        setConnectionError(errorMessage);
      }
    },
  }); // clientTools already passed in callbacks object above

  const sendUiResponseToSession = useCallback((text: string, metadata?: Record<string, unknown>) => {
    const trimmed = text?.trim();
    if (!trimmed) return;
    if (sessionStatus !== 'CONNECTED') return;
    if (currentProviderRef.current !== 'elevenlabs') return;

    try {
      sendUserMessageElevenLabs?.(trimmed);
      if (metadata && sendContextualUpdateElevenLabs) {
        sendContextualUpdateElevenLabs(JSON.stringify({
          type: 'ui_response',
          ...metadata,
        }));
      }
      addLog('info', `🗨️ UI response forwarded to session: ${trimmed}`);
    } catch (error) {
      console.error('Failed to send UI response to ElevenLabs session:', error);
      addLog('warning', `Failed to forward UI response: ${trimmed}`);
    }
  }, [addLog, sendContextualUpdateElevenLabs, sendUserMessageElevenLabs, sessionStatus]);

  useEffect(() => {
    const handleUiUserResponse = (event: Event) => {
      const customEvent = event as CustomEvent;
      const text = customEvent.detail?.text;
      if (typeof text !== 'string' || !text.trim()) return;

      sendUiResponseToSession(text, {
        source: customEvent.detail?.source || 'ui',
        metadata: customEvent.detail?.metadata || {},
      });
    };

    const handleCheckinCommitmentTap = (event: Event) => {
      const customEvent = event as CustomEvent;
      const text = customEvent.detail?.text;
      if (typeof text !== 'string' || !text.trim()) return;

      sendUiResponseToSession(text, {
        source: customEvent.detail?.source || 'checkinCommitment',
        metadata: {
          ...(customEvent.detail?.metadata || {}),
          forwardedFrom: 'uiCheckinCommitmentTap',
        },
      });
    };

    window.addEventListener('uiUserResponse', handleUiUserResponse as EventListener);
    window.addEventListener('uiCheckinCommitmentTap', handleCheckinCommitmentTap as EventListener);
    return () => {
      window.removeEventListener('uiUserResponse', handleUiUserResponse as EventListener);
      window.removeEventListener('uiCheckinCommitmentTap', handleCheckinCommitmentTap as EventListener);
    };
  }, [sendUiResponseToSession]);

  // Provider-aware wrapper functions
  const connect = useCallback(async (options: any) => {
    if (currentProviderRef.current === 'elevenlabs') {
      return connectElevenLabs(options);
    }
    return connectAzure(options);
  }, [connectAzure, connectElevenLabs]);

  const disconnect = useCallback(async (): Promise<string | null> => {
    if (currentProviderRef.current === 'elevenlabs') {
      return await disconnectElevenLabs();
    } else {
      disconnectAzure();
      return null;
    }
  }, [disconnectAzure, disconnectElevenLabs]);

  const setMicMuted = useCallback((muted: boolean) => {
    if (currentProviderRef.current === 'elevenlabs') {
      setMicMutedElevenLabs(muted);
    } else {
      setMicMutedAzure(muted);
    }
  }, [setMicMutedAzure, setMicMutedElevenLabs]);


  const handleToggleMute = () => {
    const newMutedState = !isMicMuted;
    setIsMicMuted(newMutedState);
    if (newMutedState) {
      setMemberAudioLevel(0);
    }
    setMicMuted(newMutedState);
    addLog('info', `Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
  };

  const handleEndCall = () => {
    if (sessionStatus === 'CONNECTED') {
      disconnectFromRealtime();
    }
  };

  // Check microphone permission before starting
  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      // Permission granted - stop the stream immediately (we just needed to check)
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionError(false);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicPermissionError(true);
      return false;
    }
  }, []);

  const handleStartJourney = useCallback(async (journeyId: string) => {
    console.log('🚀 handleStartJourney called with journeyId:', journeyId);
    
    if (sessionStatus !== 'DISCONNECTED') {
      addLog('warning', 'Please disconnect current session first');
      return;
    }

    setLoadingJourneyId(journeyId);

    try {
      const journey = await loadJourneyForRuntime(journeyId);
      if (journey) {
        addLog('info', `🎯 Starting journey: ${journey.name} (ID: ${journeyId})`);
        console.log('📝 Journey details:', { name: journey.name, id: journey.id, agents: journey.agents.length, voiceEnabled: journey.voiceEnabled });
        
        // For voice journeys, check microphone permission first
        if (journey.voiceEnabled !== false) {
          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            addLog('error', 'Microphone access is required to start the journey');
            setLoadingJourneyId(null);
            return;
          }
        }
        
        // Update state for UI
        setCurrentJourney(journey);
        
        // Check if this is a voice-enabled journey or non-voice
        const isVoiceJourney = journey.voiceEnabled !== false;
        console.log('🚀 handleStartJourney voice check:', {
          name: journey.name,
          voiceEnabled: journey.voiceEnabled,
          isVoiceJourney,
        });
        
        // CRITICAL: Call connectToRealtime directly without setTimeout
        // to preserve user gesture context for microphone permissions
        if (isVoiceJourney) {
          // Voice journey - connect to realtime immediately
          await connectToRealtime(journey);
        } else {
          // Non-voice journey - start in button-based mode
          // Voice will be enabled later via enable_voice tool
          console.log('🔇 Starting non-voice session for:', journey.name);
          startNonVoiceSession(journey);
        }
      } else {
        addLog('error', `Failed to load journey with ID: ${journeyId}`);
        console.error('❌ Journey not found:', journeyId);
        setLoadingJourneyId(null);
      }
    } catch (error) {
      console.error('❌ Error starting journey:', error);
      addLog('error', `Error starting journey: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoadingJourneyId(null);
    }
  }, [sessionStatus, addLog, setCurrentJourney, connectToRealtime, startNonVoiceSession, checkMicrophonePermission]);

  // Show loading overlay while preview mode is loading the journey
  if (previewLoading) {
    return (
      <div className="voice-agent voice-agent-preview-loading">
        <div className="preview-loading-content">
          <div className="preview-loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-agent">
      <AgentUIRenderer
        topControlsExtra={sessionStatus === 'CONNECTED' ? (
          <>
            <button
              className={`agent-ui-control-btn voice-agent-preview-record-btn${isPreviewRecording ? ' is-recording' : ''}`}
              onClick={isPreviewRecording ? handleStopPreviewRecording : handleStartPreviewRecording}
              disabled={previewRecordingStatus === 'starting' || previewRecordingStatus === 'stopping'}
              title={isPreviewRecording ? 'Stop preview recording' : 'Record preview video'}
            >
              {previewRecordingStatus === 'starting'
                ? 'Starting'
                : previewRecordingStatus === 'stopping'
                ? 'Stopping'
                : isPreviewRecording
                ? 'Stop'
                : 'Rec'}
            </button>
            {previewRecordingUrl && !isPreviewRecording && (
              <button
                className="agent-ui-control-btn voice-agent-preview-download-btn"
                onClick={() => {
                  downloadPreviewRecording();
                  setPreviewRecordingNotice({
                    kind: 'success',
                    message: 'Recording download started.',
                  });
                }}
                title="Download preview recording"
              >
                Save
              </button>
            )}
            {!isPreviewRecording && previewRecordingUrl && (
              <button
                className="agent-ui-control-btn voice-agent-preview-clear-btn"
                onClick={() => {
                  clearPreviewRecording();
                  setPreviewRecordingNotice({
                    kind: 'info',
                    message: 'Recording cleared from this session.',
                  });
                }}
                title="Clear preview recording"
              >
                Clear
              </button>
            )}
            {(isPreviewRecording || previewRecordingStatus === 'starting') && (
              <div className="voice-agent-preview-recording-timer" aria-live="polite">
                {previewRecordingStatus === 'starting' ? 'Starting...' : formatRecordingDuration(previewRecordingElapsedMs)}
              </div>
            )}
          </>
        ) : undefined}
        bottomBar={sessionStatus === 'CONNECTED' && !isNonVoiceMode ? (
          <VoiceControlBar
            isMuted={isMicMuted}
            activeSpeaker={activeSpeaker}
            memberAudioLevel={memberAudioLevel}
            getAgentAudioLevel={getElevenLabsOutputVolume}
            onToggleMute={handleToggleMute}
          />
        ) : undefined}
        helpOverlay={showVoiceHelp ? <VoiceHelpOverlay onClose={() => setShowVoiceHelp(false)} /> : undefined}
        onOpenHelp={sessionStatus === 'CONNECTED' ? () => setShowVoiceHelp(true) : undefined}
        onOpenSettings={sessionStatus === 'CONNECTED' && !isPreviewMode ? () => setSettingsOpen(true) : undefined}
        onExit={sessionStatus === 'CONNECTED' ? () => {
          if (isNonVoiceMode) {
            setSessionStatus('DISCONNECTED');
            setActiveSpeaker('none');
            setMemberAudioLevel(0);
            setIsNonVoiceMode(false);
            disableScreenRendering?.();
            setHasScreensVisible(false);
            addLog('info', 'Non-voice session ended');
          } else {
            handleEndCall();
          }
        } : undefined}
        showNotificationPopup={showNotificationPopup}
        onNotificationAllow={() => {
          setShowNotificationPopup(false);
          clearNotificationPlanReviewFallback();
          updateModuleState?.({ notificationsEnabled: true, notificationPermissions: 'allowed' });
          sendUiResponseToSession('I allowed notifications', {
            source: 'notification_permission',
            allowed: true,
          });
          const advanced =
            triggerNavigationFromCurrentScreen(['navigate_to_plan_review']) ||
            directNavigateFromCurrentScreen(['navigate_to_plan_review']);
          if (advanced) {
            addLog('info', '🔀 Auto-advanced after notification approval using current screen navigation event');
          }
          console.log('🔔 Notifications enabled');
        }}
        onNotificationDeny={() => {
          setShowNotificationPopup(false);
          clearNotificationPlanReviewFallback();
          updateModuleState?.({ notificationsEnabled: false, notificationPermissions: 'denied' });
          sendUiResponseToSession("I don't want notifications", {
            source: 'notification_permission',
            allowed: false,
          });
          const advanced =
            triggerNavigationFromCurrentScreen(['navigate_to_plan_review']) ||
            directNavigateFromCurrentScreen(['navigate_to_plan_review']);
          if (advanced) {
            addLog('info', '🔀 Auto-advanced after notification denial using current screen navigation event');
          }
          console.log('🔔 Notifications denied');
        }}
        onSetVoiceEnabled={handleSetVoiceEnabled}
        activeSpeaker={activeSpeaker}
        memberAudioLevel={memberAudioLevel}
        getOutputVolume={getElevenLabsOutputVolume}
        sessionConnected={sessionStatus === 'CONNECTED'}
        agentSpeechAlignment={agentSpeechAlignment}
        agentSpeechPlaybackMs={agentSpeechPlaybackMs}
        agentSpeechPlaybackAnchorMs={agentSpeechPlaybackAnchorMs}
        onPreviewContainerReady={setPreviewCaptureElement}
      />
      {previewRecordingNotice && sessionStatus === 'CONNECTED' && (
        <div
          className={`voice-agent-preview-recording-notice voice-agent-preview-recording-notice-${previewRecordingNotice.kind}`}
          role="status"
          aria-live="polite"
        >
          {previewRecordingNotice.message}
        </div>
      )}
      
      {/* Header - Show when disconnected and NOT in preview mode, transitioning, or loading */}
      {sessionStatus === 'DISCONNECTED' && !isPreviewMode && !isTransitioningJourney && !loadingJourneyId && !showFeedbackForm && (
        <div className="voice-agent-header">
          <h2 className="voice-agent-title">Flows</h2>
          {isAdmin && (
            <div className="voice-agent-header-actions">
              <button
                className="voice-agent-import-btn"
                onClick={handleImportNewFlow}
              >
                Import Flow
              </button>
              <button
                className="voice-agent-create-btn"
                onClick={() => navigate('/builder?new=true')}
              >
                Create Flow
              </button>
            </div>
          )}
        </div>
      )}

      {/* Persona Settings Panel */}
      {settingsOpen && sessionStatus === 'DISCONNECTED' && (
        <div className="voice-agent-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="voice-agent-settings-panel voice-agent-settings-compact" onClick={(e) => e.stopPropagation()}>
            <div className="voice-agent-settings-header">
              <h2>Member Settings</h2>
              <button
                className="voice-agent-settings-close"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="voice-agent-settings-content">
              <MemberPersonaEditor
                disabled={sessionStatus !== 'DISCONNECTED'}
                onPersonaChange={handlePersonaChange}
                onPQDataChange={handlePQDataChange}
                onVoiceChange={handleVoiceChange}
                onSave={() => setSettingsOpen(false)}
                initialEnabled={personaEnabled}
                initialDescription={personaDescription}
                initialPQData={pqData}
                initialVoice={selectedVoice}
              />
            </div>
          </div>
        </div>
      )}

      {/* Session Logs Panel - Only during active session */}
      {settingsOpen && sessionStatus === 'CONNECTED' && (
        <div className="voice-agent-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="voice-agent-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="voice-agent-settings-header">
              <h2>Session Logs</h2>
              <button
                className="voice-agent-settings-close"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="voice-agent-settings-content">
              {/* Export Controls */}
              <div className="voice-agent-export-controls">
                <h3>Export Session</h3>
                <div className="voice-agent-export-buttons">
                  <button
                    className="voice-agent-export-btn"
                    onClick={exportPromptAndTranscript}
                    title="Download both the prompt and a formatted transcript"
                  >
                    Download Prompt + Transcript
                  </button>
                  <button
                    className="voice-agent-export-btn voice-agent-export-btn-secondary"
                    onClick={exportPrompt}
                    title="Download just the prompt that was sent to the agent"
                  >
                    Prompt Only
                  </button>
                  <button
                    className="voice-agent-export-btn voice-agent-export-btn-secondary"
                    onClick={exportSessionTranscript}
                    title="Download human-readable conversation transcript"
                  >
                    Transcript Only
                  </button>
                  <button
                    className="voice-agent-export-btn voice-agent-export-btn-tertiary"
                    onClick={exportRawSession}
                    title="Download raw JSON for developer iteration"
                  >
                    Raw JSON (Dev)
                  </button>
                </div>
              </div>

              <SessionLogViewer
                logs={sessionLogs}
                journey={currentJourney}
                currentAgentName={currentAgentRef.current}
                combinedPrompt={combinedPromptRef.current}
                flowContext={flowContext || {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Journeys Content - Hide in preview mode and during journey transitions */}
      {!isPreviewMode && !isTransitioningJourney && !showFeedbackForm && (
      <div className="voice-agent-content">
        <div className="voice-agent-session-view">
          {sessionStatus === 'DISCONNECTED' && loadingJourneyId ? (
            <div className="journey-loading-screen">
              <div className="journey-loading-content">
                <div className="journey-loading-spinner"></div>
                <p className="journey-loading-text">Starting flow...</p>
                <p className="journey-loading-subtext">
                  {availableJourneys.find(j => j.id === loadingJourneyId)?.name || 'Loading'}
                </p>
              </div>
            </div>
          ) : sessionStatus === 'DISCONNECTED' ? (
            <div className="journeys-grid-container">
              <div className="journeys-grid">
                {availableJourneys.map((journey) => {
                    // Map journey names to gradient backgrounds and icons
                    const getJourneyStyle = (name: string) => {
                      if (name.toLowerCase().includes('intake')) {
                        return { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '🎙️' };
                      }
                      if (name.toLowerCase().includes('mental') || name.toLowerCase().includes('screening')) {
                        return { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '🧠' };
                      }
                      if (name.toLowerCase().includes('january') || name.toLowerCase().includes('dry')) {
                        return { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '🎯' };
                      }
                      return { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', icon: '✨' };
                    };
                    
                    const style = getJourneyStyle(journey.name);
                    
                    return (
                      <div key={journey.id} className="journey-card">
                        <div
                          className="journey-card-image-placeholder"
                          style={{ background: style.gradient }}
                        >
                          <span className="journey-card-icon">{style.icon}</span>
                          <div className="journey-card-actions">
                            {isAdmin && (
                              <button
                                className="journey-card-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/builder?id=${journey.id}`);
                                }}
                                title="Edit flow"
                              >
                                <EditIcon size={14} />
                              </button>
                            )}
                            <button
                              className="journey-card-settings-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettingsOpen(true);
                              }}
                              title="Configure testing persona"
                            >
                              <SettingsIcon size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="journey-card-header">
                          <h3 className="journey-card-title">{journey.name}</h3>
                          <span className="journey-card-badge">{journey.agentCount} {journey.agentCount === 1 ? 'agent' : 'agents'}</span>
                        </div>
                        <p className="journey-card-description">{journey.description}</p>
                        <button
                          className="journey-card-start-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Start button clicked for journey:', journey.id);
                            handleStartJourney(journey.id);
                          }}
                          disabled={sessionStatus !== 'DISCONNECTED'}
                          type="button"
                        >
                          Start
                        </button>
                      </div>
                    );
                  })}
                  
                  {journeysLoading && (
                    <div className="journeys-loading-state">
                      <p>Loading flows...</p>
                    </div>
                  )}
                  {!journeysLoading && availableJourneys.length === 0 && (
                    <div className="journeys-empty-state">
                      <h3>No flows available</h3>
                      <p>Click "Create Flow" to get started</p>
                    </div>
                  )}
              </div>

            </div>
          ) : null}
        </div>
      </div>
      )}
      
      {/* Microphone Permission Error Modal */}
      {micPermissionError && (
        <div className="voice-agent-settings-overlay" onClick={() => setMicPermissionError(false)}>
          <div className="mic-permission-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mic-permission-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
            <h3>Microphone Access Required</h3>
            <p>To start this flow, we need access to your microphone. Please enable microphone permissions in your browser settings and try again.</p>
            <div className="mic-permission-instructions">
              <strong>How to enable:</strong>
              <ol>
                <li>Click the lock or settings icon in your browser's address bar</li>
                <li>Find "Microphone" in the permissions list</li>
                <li>Change the setting to "Allow"</li>
                <li>Refresh the page and try again</li>
              </ol>
            </div>
            <button 
              className="mic-permission-btn"
              onClick={() => setMicPermissionError(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
      
      {/* Connection Error Modal */}
      {connectionError && (
        <div className="voice-agent-settings-overlay" onClick={() => setConnectionError(null)}>
          <div className="mic-permission-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mic-permission-icon" style={{ color: '#dc3545' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <h3>Connection Failed</h3>
            <p style={{ wordBreak: 'break-word' }}>{connectionError}</p>
            <div className="mic-permission-instructions">
              <strong>Troubleshooting:</strong>
              <ol>
                <li>Check that the ElevenLabs API key is configured in secrets</li>
                <li>Verify the Agent ID is correct in the flow settings</li>
                <li>Ensure your browser allows microphone access</li>
                <li>Try refreshing the page and trying again</li>
              </ol>
            </div>
            <button 
              className="mic-permission-btn"
              onClick={() => setConnectionError(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
      
      {/* Full-screen Feedback Survey */}
      {showFeedbackForm && feedbackSessionId && (
        <FeedbackSurvey
          voiceSessionId={feedbackSessionId}
          isPreviewMode={isPreviewMode}
          onSubmit={() => {
            setShowFeedbackForm(false);
            setFeedbackSessionId(null);
          }}
          onSkip={() => {
            setShowFeedbackForm(false);
            setFeedbackSessionId(null);
          }}
        />
      )}
      
    </div>
  );
}

// Wrapper with Providers
const VoiceAgent: React.FC = () => {
  return (
    <ErrorBoundary componentName="VoiceAgent">
      <TranscriptProvider>
        <EventProvider>
          <AgentUIProvider>
            <VoiceAgentContent />
          </AgentUIProvider>
        </EventProvider>
      </TranscriptProvider>
    </ErrorBoundary>
  );
};

export default VoiceAgent;
