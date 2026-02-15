import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgentMessageCardElementState, AgentMessageCardElementStyle } from '../../../types/journey';
import { ElevenLabsAudioAlignmentSnapshot } from '../../../types/voiceAgent';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './AgentMessageCardElement.css';

export interface AgentMessageCardElementProps {
  data: AgentMessageCardElementState;
  style?: AgentMessageCardElementStyle;
  agentSpeechAlignment?: ElevenLabsAudioAlignmentSnapshot | null;
  agentSpeechPlaybackMs?: number | null;
  agentSpeechPlaybackAnchorMs?: number | null;
}

interface AlignmentWordTiming {
  startMs: number;
  endMs: number;
}

interface NormalizedAlignment {
  text: string;
  words: AlignmentWordTiming[];
}

interface MessageToken {
  text: string;
  isWhitespace: boolean;
  wordIndex: number | null;
}

const BASE_WORD_OPACITY = 0.26;
const MIN_WORD_REVEAL_DURATION_MS = 90;
const FALLBACK_WORD_STEP_MS = 120;
const FALLBACK_WORD_REVEAL_DURATION_MS = 220;
const MIN_PROJECTED_WORD_STEP_MS = 90;
const MAX_PROJECTED_WORD_STEP_MS = 420;
const ALIGNMENT_TAIL_PADDING_MS = 240;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function getMedian(values: number[]): number | null {
  const filtered = values.filter((value) => Number.isFinite(value) && value > 0);
  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }
  return sorted[middleIndex];
}

function getProjectedWordStepMs(words: AlignmentWordTiming[]): number {
  if (words.length <= 1) return FALLBACK_WORD_STEP_MS;

  const startGaps: number[] = [];
  const durations: number[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    durations.push(current.endMs - current.startMs);

    if (index === 0) continue;
    const previous = words[index - 1];
    startGaps.push(current.startMs - previous.startMs);
  }

  const gapMedian = getMedian(startGaps);
  const durationMedian = getMedian(durations);
  const fallbackCandidate = gapMedian ?? durationMedian ?? FALLBACK_WORD_STEP_MS;
  const blendedCandidate =
    gapMedian !== null && durationMedian !== null
      ? (gapMedian * 0.7) + (durationMedian * 0.3)
      : fallbackCandidate;

  return clamp(blendedCandidate, MIN_PROJECTED_WORD_STEP_MS, MAX_PROJECTED_WORD_STEP_MS);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item : String(item)));
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'number' && Number.isFinite(item)) return item;
      if (typeof item === 'string') {
        const parsed = Number(item);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((item): item is number => item !== null);
}

function toMsFromSeconds(values: number[]): number[] {
  return values.map((value) => value * 1000);
}

function hasFractionalValue(values: number[]): boolean {
  return values.some((value) => Math.abs(value - Math.round(value)) > 0.0001);
}

const ALIGNMENT_CHARACTER_KEYS = ['characters', 'chars'];
const ALIGNMENT_START_TIME_KEYS_MS = [
  'char_start_times_ms',
  'charStartTimesMs',
  'character_start_times_ms',
  'characterStartTimesMs',
  'start_times_ms',
  'startTimesMs',
];
const ALIGNMENT_START_TIME_KEYS_SECONDS = [
  'char_start_times_seconds',
  'charStartTimesSeconds',
  'character_start_times_seconds',
  'characterStartTimesSeconds',
  'start_times_seconds',
  'startTimesSeconds',
];
const ALIGNMENT_START_TIME_KEYS_AMBIGUOUS = [
  'char_start_times',
  'charStartTimes',
  'character_start_times',
  'characterStartTimes',
  'start_times',
  'startTimes',
];
const ALIGNMENT_DURATION_KEYS_MS = [
  'char_durations_ms',
  'charDurationsMs',
  'character_durations_ms',
  'characterDurationsMs',
  'durations_ms',
  'durationsMs',
];
const ALIGNMENT_DURATION_KEYS_SECONDS = [
  'char_durations_seconds',
  'charDurationsSeconds',
  'character_durations_seconds',
  'characterDurationsSeconds',
  'durations_seconds',
  'durationsSeconds',
];
const ALIGNMENT_DURATION_KEYS_AMBIGUOUS = [
  'char_durations',
  'charDurations',
  'character_durations',
  'characterDurations',
  'durations',
];
const ALIGNMENT_END_TIME_KEYS_MS = [
  'char_end_times_ms',
  'charEndTimesMs',
  'character_end_times_ms',
  'characterEndTimesMs',
  'end_times_ms',
  'endTimesMs',
];
const ALIGNMENT_END_TIME_KEYS_SECONDS = [
  'char_end_times_seconds',
  'charEndTimesSeconds',
  'character_end_times_seconds',
  'characterEndTimesSeconds',
  'end_times_seconds',
  'endTimesSeconds',
];
const ALIGNMENT_END_TIME_KEYS_AMBIGUOUS = [
  'char_end_times',
  'charEndTimes',
  'character_end_times',
  'characterEndTimes',
  'end_times',
  'endTimes',
];
const ALIGNMENT_WORD_LIST_KEYS = [
  'words',
  'word_timings',
  'wordTimings',
  'word_alignment',
  'wordAlignment',
  'alignment_words',
  'alignmentWords',
];
const ALIGNMENT_WORD_TEXT_KEYS = ['text', 'word', 'token', 'value'];
const ALIGNMENT_WORD_START_KEYS_MS = [
  'start_ms',
  'startMs',
  'start_time_ms',
  'startTimeMs',
];
const ALIGNMENT_WORD_START_KEYS_SECONDS = [
  'start_time_seconds',
  'startTimeSeconds',
  'start_seconds',
  'startSeconds',
  'start_time',
  'startTime',
];
const ALIGNMENT_WORD_START_KEYS_AMBIGUOUS = [
  'start',
];
const ALIGNMENT_WORD_END_KEYS_MS = [
  'end_ms',
  'endMs',
  'end_time_ms',
  'endTimeMs',
];
const ALIGNMENT_WORD_END_KEYS_SECONDS = [
  'end_time_seconds',
  'endTimeSeconds',
  'end_seconds',
  'endSeconds',
  'end_time',
  'endTime',
];
const ALIGNMENT_WORD_END_KEYS_AMBIGUOUS = [
  'end',
];
const ALIGNMENT_WORD_DURATION_KEYS_MS = [
  'duration_ms',
  'durationMs',
  'word_duration_ms',
  'wordDurationMs',
];
const ALIGNMENT_WORD_DURATION_KEYS_SECONDS = [
  'duration_seconds',
  'durationSeconds',
  'word_duration_seconds',
  'wordDurationSeconds',
];
const ALIGNMENT_WORD_DURATION_KEYS_AMBIGUOUS = ['duration'];

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getFirstDefinedValue(payload: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function getNumberArrayFromKeys(payload: Record<string, unknown>, keys: string[]): number[] {
  return toNumberArray(getFirstDefinedValue(payload, keys));
}

function getTimeArrayMs(
  payload: Record<string, unknown>,
  msKeys: string[],
  secondsKeys: string[],
  ambiguousKeys: string[]
): number[] {
  const msValues = getNumberArrayFromKeys(payload, msKeys);
  if (msValues.length > 0) return msValues;

  const secondsValues = getNumberArrayFromKeys(payload, secondsKeys);
  if (secondsValues.length > 0) {
    return toMsFromSeconds(secondsValues);
  }

  const ambiguousValues = getNumberArrayFromKeys(payload, ambiguousKeys);
  if (!ambiguousValues.length) return [];

  // Ambiguous arrays are interpreted as seconds only when fractional.
  if (hasFractionalValue(ambiguousValues)) {
    return toMsFromSeconds(ambiguousValues);
  }
  return ambiguousValues;
}

function getFirstFiniteNumber(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const candidate = payload[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function getTimedValueMs(
  payload: Record<string, unknown>,
  msKeys: string[],
  secondsKeys: string[],
  ambiguousKeys: string[]
): number | null {
  const msValue = getFirstFiniteNumber(payload, msKeys);
  if (msValue !== null) return msValue;

  const secondValue = getFirstFiniteNumber(payload, secondsKeys);
  if (secondValue !== null) return secondValue * 1000;

  const ambiguousValue = getFirstFiniteNumber(payload, ambiguousKeys);
  if (ambiguousValue === null) return null;

  // Ambiguous fields (start/end/duration) are interpreted as seconds when fractional.
  if (Math.abs(ambiguousValue - Math.round(ambiguousValue)) > 0.0001) {
    return ambiguousValue * 1000;
  }
  return ambiguousValue;
}

function buildWordTimingsFromCharacters(
  characters: string[],
  startCandidates: number[],
  durationCandidates: number[]
): AlignmentWordTiming[] {
  const starts: number[] = [];
  const durations: number[] = [];

  for (let index = 0; index < characters.length; index += 1) {
    const fallbackStart = index === 0 ? 0 : starts[index - 1] + durations[index - 1];
    const start = startCandidates[index] ?? fallbackStart;
    const nextStart = startCandidates[index + 1];
    const fallbackDuration = Number.isFinite(nextStart) ? Math.max(1, nextStart - start) : 90;
    const duration = Math.max(1, durationCandidates[index] ?? fallbackDuration);
    starts.push(Math.max(0, start));
    durations.push(duration);
  }

  const words: AlignmentWordTiming[] = [];
  let currentWordStart: number | null = null;
  let currentWordEnd: number | null = null;

  for (let index = 0; index < characters.length; index += 1) {
    const char = characters[index];
    const isWhitespace = /\s/.test(char);
    const start = starts[index];
    const end = start + durations[index];

    if (isWhitespace) {
      if (currentWordStart !== null && currentWordEnd !== null) {
        words.push({ startMs: currentWordStart, endMs: currentWordEnd });
        currentWordStart = null;
        currentWordEnd = null;
      }
      continue;
    }

    if (currentWordStart === null) {
      currentWordStart = start;
      currentWordEnd = end;
    } else {
      currentWordEnd = end;
    }
  }

  if (currentWordStart !== null && currentWordEnd !== null) {
    words.push({ startMs: currentWordStart, endMs: currentWordEnd });
  }

  return words;
}

function parseWordAlignmentPayload(payload: Record<string, unknown>): NormalizedAlignment | null {
  const rawWords = getFirstDefinedValue(payload, ALIGNMENT_WORD_LIST_KEYS);
  if (!Array.isArray(rawWords)) return null;

  const wordEntries = rawWords
    .map((entry) => toRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
  if (!wordEntries.length) return null;

  const entriesWithTiming = wordEntries
    .map((entry) => {
      const start = getTimedValueMs(
        entry,
        ALIGNMENT_WORD_START_KEYS_MS,
        ALIGNMENT_WORD_START_KEYS_SECONDS,
        ALIGNMENT_WORD_START_KEYS_AMBIGUOUS
      );
      if (start === null) return null;

      const entryText = getFirstDefinedValue(entry, ALIGNMENT_WORD_TEXT_KEYS);
      const text = typeof entryText === 'string' && entryText.trim().length > 0
        ? entryText.trim()
        : '';

      const directEnd = getTimedValueMs(
        entry,
        ALIGNMENT_WORD_END_KEYS_MS,
        ALIGNMENT_WORD_END_KEYS_SECONDS,
        ALIGNMENT_WORD_END_KEYS_AMBIGUOUS
      );
      if (directEnd !== null) {
        return { start, end: directEnd, text };
      }

      const duration = getTimedValueMs(
        entry,
        ALIGNMENT_WORD_DURATION_KEYS_MS,
        ALIGNMENT_WORD_DURATION_KEYS_SECONDS,
        ALIGNMENT_WORD_DURATION_KEYS_AMBIGUOUS
      );
      if (duration !== null) {
        return { start, end: start + duration, text };
      }

      return { start, end: start + 200, text };
    })
    .filter((entry): entry is { start: number; end: number; text: string } => entry !== null);

  if (!entriesWithTiming.length) return null;

  const startRaw = entriesWithTiming.map((entry) => entry.start);
  const endRaw = entriesWithTiming.map((entry) => entry.end);
  const startMsValues = startRaw;
  const endMsValues = endRaw;

  const words: AlignmentWordTiming[] = [];
  let textParts: string[] = [];

  for (let index = 0; index < entriesWithTiming.length; index += 1) {
    const startMs = startMsValues[index];
    const endMsCandidate = endMsValues[index];
    if (!Number.isFinite(startMs)) continue;

    const safeEndMs = Number.isFinite(endMsCandidate)
      ? Math.max(startMs + 1, endMsCandidate)
      : startMs + 120;
    words.push({ startMs: Math.max(0, startMs), endMs: Math.max(0, safeEndMs) });

    if (entriesWithTiming[index].text.length > 0) {
      textParts.push(entriesWithTiming[index].text);
    }
  }

  if (!words.length) return null;

  const text = textParts.join(' ').trim();
  const fallbackText = typeof payload.text === 'string' ? payload.text.trim() : '';
  return {
    text: text.length > 0 ? text : fallbackText,
    words,
  };
}

function parseCharacterAlignmentPayload(payload: Record<string, unknown>): NormalizedAlignment | null {
  const characters = toStringArray(getFirstDefinedValue(payload, ALIGNMENT_CHARACTER_KEYS));
  if (!characters.length) return null;

  const startCandidates = getTimeArrayMs(
    payload,
    ALIGNMENT_START_TIME_KEYS_MS,
    ALIGNMENT_START_TIME_KEYS_SECONDS,
    ALIGNMENT_START_TIME_KEYS_AMBIGUOUS
  );
  const durationCandidates = getTimeArrayMs(
    payload,
    ALIGNMENT_DURATION_KEYS_MS,
    ALIGNMENT_DURATION_KEYS_SECONDS,
    ALIGNMENT_DURATION_KEYS_AMBIGUOUS
  );
  const endCandidates = getTimeArrayMs(
    payload,
    ALIGNMENT_END_TIME_KEYS_MS,
    ALIGNMENT_END_TIME_KEYS_SECONDS,
    ALIGNMENT_END_TIME_KEYS_AMBIGUOUS
  );

  if (endCandidates.length > 0 && startCandidates.length > 0) {
    for (let index = 0; index < startCandidates.length; index += 1) {
      if (Number.isFinite(durationCandidates[index])) continue;
      const start = startCandidates[index];
      const end = endCandidates[index];
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      durationCandidates[index] = Math.max(1, end - start);
    }
  }

  const words = buildWordTimingsFromCharacters(characters, startCandidates, durationCandidates);
  if (!words.length) return null;

  return {
    text: characters.join(''),
    words,
  };
}

function parseAlignmentPayload(payload: Record<string, unknown>): NormalizedAlignment | null {
  const characterAlignment = parseCharacterAlignmentPayload(payload);
  if (characterAlignment) return characterAlignment;

  const wordAlignment = parseWordAlignmentPayload(payload);
  if (wordAlignment) return wordAlignment;

  return null;
}

function normalizeAlignment(raw: unknown): NormalizedAlignment | null {
  const root = toRecord(raw);
  if (!root) return null;

  const queue: Record<string, unknown>[] = [root];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const parsed = parseAlignmentPayload(current);
    if (parsed) return parsed;

    const nestedCandidates: unknown[] = [
      current.alignment,
      current.audio_alignment,
      current.audioAlignment,
      current.normalizedAlignment,
      current.word_alignment,
      current.wordAlignment,
      current.tts_alignment,
      current.ttsAlignment,
      current.raw,
      current.data,
      current.audio_event,
      current.audioEvent,
    ];

    for (const candidate of nestedCandidates) {
      const nestedObject = toRecord(candidate);
      if (nestedObject && !visited.has(nestedObject)) {
        queue.push(nestedObject);
      }
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          const nestedObject = toRecord(entry);
          if (nestedObject && !visited.has(nestedObject)) {
            queue.push(nestedObject);
          }
        }
        continue;
      }

      const nestedObject = toRecord(value);
      if (nestedObject && !visited.has(nestedObject)) {
        queue.push(nestedObject);
      }
    }
  }

  return null;
}

function getComparableWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function hasSufficientWordOverlap(message: string, alignmentText: string): boolean {
  const messageWords = new Set(getComparableWords(message));
  const alignmentWords = new Set(getComparableWords(alignmentText));

  if (!messageWords.size || !alignmentWords.size) return true;

  let overlapCount = 0;
  messageWords.forEach((word) => {
    if (alignmentWords.has(word)) overlapCount += 1;
  });

  const requiredWords = Math.min(messageWords.size, alignmentWords.size);
  if (requiredWords <= 3) {
    return overlapCount >= 1;
  }
  return (overlapCount / requiredWords) >= 0.35;
}

export const AgentMessageCardElement: React.FC<AgentMessageCardElementProps> = ({
  data,
  style,
  agentSpeechAlignment,
  agentSpeechPlaybackMs,
  agentSpeechPlaybackAnchorMs,
}) => {
  const syncWithSpeech = data.syncWithSpeech !== false;
  const normalizedAlignment = useMemo(
    () => normalizeAlignment(agentSpeechAlignment?.raw),
    [agentSpeechAlignment]
  );
  const messageTokens = useMemo(() => {
    const source = typeof data.message === 'string' ? data.message : '';
    const splitTokens = source.split(/(\s+)/);
    let wordCounter = 0;

    return splitTokens.map((token): MessageToken => {
      if (!token || /^\s+$/.test(token)) {
        return { text: token, isWhitespace: true, wordIndex: null };
      }

      const wordIndex = wordCounter;
      wordCounter += 1;
      return { text: token, isWhitespace: false, wordIndex };
    });
  }, [data.message]);
  const totalWordCount = useMemo(
    () => messageTokens.reduce((count, token) => (token.isWhitespace ? count : count + 1), 0),
    [messageTokens]
  );

  const shouldUseAlignment = useMemo(() => {
    if (!syncWithSpeech || !normalizedAlignment || totalWordCount === 0) return false;
    if (normalizedAlignment.words.length === 0) return false;
    if (!normalizedAlignment.text.trim()) return true;
    return hasSufficientWordOverlap(data.message ?? '', normalizedAlignment.text);
  }, [data.message, normalizedAlignment, syncWithSpeech, totalWordCount]);
  const projectedAlignmentStepMs = useMemo(() => {
    if (!shouldUseAlignment || !normalizedAlignment) return FALLBACK_WORD_STEP_MS;
    return getProjectedWordStepMs(normalizedAlignment.words);
  }, [normalizedAlignment, shouldUseAlignment]);
  const projectedAlignmentTailEndMs = useMemo(() => {
    if (!shouldUseAlignment || !normalizedAlignment || totalWordCount === 0) return 0;

    const alignmentWordCount = normalizedAlignment.words.length;
    const lastAlignedWordEndMs = normalizedAlignment.words[alignmentWordCount - 1]?.endMs ?? 0;
    const remainingWordCount = Math.max(totalWordCount - alignmentWordCount, 0);

    if (remainingWordCount === 0) {
      return lastAlignedWordEndMs;
    }

    return lastAlignedWordEndMs + (remainingWordCount * projectedAlignmentStepMs);
  }, [normalizedAlignment, projectedAlignmentStepMs, shouldUseAlignment, totalWordCount]);
  const playbackSynchronizedElapsedSpeechMs = useMemo(() => {
    if (!shouldUseAlignment) return null;
    if (!Number.isFinite(agentSpeechPlaybackMs) || !Number.isFinite(agentSpeechPlaybackAnchorMs)) {
      return null;
    }
    return Math.max(0, (agentSpeechPlaybackMs as number) - (agentSpeechPlaybackAnchorMs as number));
  }, [agentSpeechPlaybackAnchorMs, agentSpeechPlaybackMs, shouldUseAlignment]);

  const [elapsedSpeechMs, setElapsedSpeechMs] = useState<number | null>(null);
  const [fallbackElapsedSpeechMs, setFallbackElapsedSpeechMs] = useState<number | null>(null);
  const animationStartRef = useRef<number | null>(null);
  const fallbackAnimationStartRef = useRef<number | null>(null);
  const previousAlignmentTextRef = useRef<string>('');
  const previousAlignmentWordCountRef = useRef<number>(0);
  const previousAlignmentReceivedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldUseAlignment || !normalizedAlignment) {
      animationStartRef.current = null;
      previousAlignmentTextRef.current = '';
      previousAlignmentWordCountRef.current = 0;
      previousAlignmentReceivedAtRef.current = null;
      setElapsedSpeechMs(null);
      return;
    }

    const currentReceivedAt = agentSpeechAlignment?.receivedAtMs ?? Date.now();
    const previousReceivedAt = previousAlignmentReceivedAtRef.current;
    const arrivedSoonAfterPrevious =
      previousReceivedAt !== null
      && currentReceivedAt >= previousReceivedAt
      && (currentReceivedAt - previousReceivedAt) < 900;
    const textBasedContinuation =
      arrivedSoonAfterPrevious
      && previousAlignmentTextRef.current.length > 0
      && normalizedAlignment.text.startsWith(previousAlignmentTextRef.current);
    const wordCountBasedContinuation =
      arrivedSoonAfterPrevious
      && previousAlignmentWordCountRef.current > 0
      && normalizedAlignment.words.length >= previousAlignmentWordCountRef.current;
    const isContinuation = textBasedContinuation || wordCountBasedContinuation;

    if (!isContinuation) {
      animationStartRef.current = performance.now();
      setElapsedSpeechMs(0);
    }

    previousAlignmentTextRef.current = normalizedAlignment.text;
    previousAlignmentWordCountRef.current = normalizedAlignment.words.length;
    previousAlignmentReceivedAtRef.current = currentReceivedAt;
  }, [agentSpeechAlignment?.receivedAtMs, normalizedAlignment, shouldUseAlignment]);

  useEffect(() => {
    if (!shouldUseAlignment || !normalizedAlignment || totalWordCount === 0) return;
    if (playbackSynchronizedElapsedSpeechMs !== null) return;

    let animationFrameId = 0;
    const tick = () => {
      const startedAt = animationStartRef.current ?? performance.now();
      if (animationStartRef.current === null) {
        animationStartRef.current = startedAt;
      }

      const elapsedMs = performance.now() - startedAt;
      setElapsedSpeechMs((currentValue) => {
        if (currentValue === null) return elapsedMs;
        if (Math.abs(currentValue - elapsedMs) < 16) return currentValue;
        return elapsedMs;
      });

      if (elapsedMs < projectedAlignmentTailEndMs + ALIGNMENT_TAIL_PADDING_MS) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playbackSynchronizedElapsedSpeechMs, projectedAlignmentTailEndMs, shouldUseAlignment, totalWordCount]);

  useEffect(() => {
    if (!syncWithSpeech || shouldUseAlignment || totalWordCount === 0) {
      fallbackAnimationStartRef.current = null;
      setFallbackElapsedSpeechMs(null);
      return;
    }

    fallbackAnimationStartRef.current = performance.now();
    setFallbackElapsedSpeechMs(0);

    const totalRevealWindowMs = (Math.max(totalWordCount - 1, 0) * FALLBACK_WORD_STEP_MS) + 420;
    let animationFrameId = 0;

    const tick = () => {
      const startedAt = fallbackAnimationStartRef.current ?? performance.now();
      if (fallbackAnimationStartRef.current === null) {
        fallbackAnimationStartRef.current = startedAt;
      }

      const elapsedMs = performance.now() - startedAt;
      setFallbackElapsedSpeechMs((currentValue) => {
        if (currentValue === null) return elapsedMs;
        if (Math.abs(currentValue - elapsedMs) < 16) return currentValue;
        return elapsedMs;
      });

      if (elapsedMs < totalRevealWindowMs) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [data.message, shouldUseAlignment, syncWithSpeech, totalWordCount]);

  const getWordVisualState = (wordIndex: number | null): React.CSSProperties => {
    if (wordIndex === null) return { opacity: 1, filter: 'blur(0px)' };

    if (!shouldUseAlignment || !normalizedAlignment) {
      if (!syncWithSpeech || fallbackElapsedSpeechMs === null) {
        return { opacity: 1, filter: 'blur(0px)' };
      }

      const fallbackStartMs = wordIndex * FALLBACK_WORD_STEP_MS;
      const fallbackProgress = clamp01(
        (fallbackElapsedSpeechMs - fallbackStartMs) / FALLBACK_WORD_REVEAL_DURATION_MS
      );
      const opacity = BASE_WORD_OPACITY + ((1 - BASE_WORD_OPACITY) * fallbackProgress);
      const blurPx = (1 - fallbackProgress) * 1.2;

      return {
        opacity,
        filter: `blur(${blurPx.toFixed(2)}px)`,
      };
    }

    const activeElapsedSpeechMs = playbackSynchronizedElapsedSpeechMs ?? elapsedSpeechMs ?? 0;

    const alignmentWordCount = normalizedAlignment.words.length;
    if (alignmentWordCount === 0) {
      return { opacity: 1, filter: 'blur(0px)' };
    }

    if (wordIndex >= alignmentWordCount) {
      const lastAlignedWordEndMs = normalizedAlignment.words[alignmentWordCount - 1]?.endMs ?? 0;
      const extrapolatedWordIndex = wordIndex - alignmentWordCount;
      const extrapolatedStartMs = lastAlignedWordEndMs + (extrapolatedWordIndex * projectedAlignmentStepMs);
      const extrapolatedDurationMs = Math.max(
        MIN_WORD_REVEAL_DURATION_MS,
        projectedAlignmentStepMs * 0.92
      );
      const extrapolatedProgress = clamp01(
        (activeElapsedSpeechMs - extrapolatedStartMs) / extrapolatedDurationMs
      );
      const opacity = BASE_WORD_OPACITY + ((1 - BASE_WORD_OPACITY) * extrapolatedProgress);
      const blurPx = (1 - extrapolatedProgress) * 1.4;

      return {
        opacity,
        filter: `blur(${blurPx.toFixed(2)}px)`,
      };
    }

    const mappedAlignmentWordIndex = wordIndex;
    const wordTiming = normalizedAlignment.words[mappedAlignmentWordIndex];
    if (!wordTiming) {
      return { opacity: 1, filter: 'blur(0px)' };
    }

    const revealDurationMs = Math.max(MIN_WORD_REVEAL_DURATION_MS, wordTiming.endMs - wordTiming.startMs);
    const revealProgress = clamp01((activeElapsedSpeechMs - wordTiming.startMs) / revealDurationMs);
    const opacity = BASE_WORD_OPACITY + ((1 - BASE_WORD_OPACITY) * revealProgress);
    const blurPx = (1 - revealProgress) * 1.4;

    return {
      opacity,
      filter: `blur(${blurPx.toFixed(2)}px)`,
    };
  };

  const getCardStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};
    
    if (style?.backgroundColor) {
      const cssVar = mapIOSColorToCSSVar(style.backgroundColor);
      styles.backgroundColor = `var(${cssVar})`;
    }
    
    if (style?.cornerRadius) {
      styles.borderRadius = `${style.cornerRadius}px`;
    }
    
    return styles;
  };

  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const rawMessage = typeof data.message === 'string' ? data.message : '';
  const isPlaceholder = !rawMessage || rawMessage.startsWith('{$');
  if (isPlaceholder) {
    return null;
  }

  return (
    <div 
      className="agent-message-card-element"
      style={getCardStyle()}
      data-element-id={data.id}
    >
      <div className="agent-message-card-header">
        <div className="agent-message-card-avatar">
          {data.avatar || '🤖'}
        </div>
        <div className="agent-message-card-meta">
          <div className="agent-message-card-name pelago-body-2-bold">
            {data.agentName || 'Agent'}
          </div>
          {data.timestamp && (
            <div className="agent-message-card-time pelago-caption-2-regular">
              {formatTime(data.timestamp)}
            </div>
          )}
        </div>
      </div>
      <div className="agent-message-card-message">
        {messageTokens.map((token, tokenIndex) => {
          if (token.isWhitespace) {
            return (
              <React.Fragment key={`space-${tokenIndex}`}>
                {token.text}
              </React.Fragment>
            );
          }

          return (
            <span
              key={`word-${tokenIndex}`}
              className="agent-message-card-word"
              style={getWordVisualState(token.wordIndex)}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default AgentMessageCardElement;
