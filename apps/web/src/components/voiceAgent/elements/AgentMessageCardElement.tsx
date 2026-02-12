import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AgentMessageCardElementState, AgentMessageCardElementStyle } from '../../../types/journey';
import { ElevenLabsAudioAlignmentSnapshot } from '../../../types/voiceAgent';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './AgentMessageCardElement.css';

export interface AgentMessageCardElementProps {
  data: AgentMessageCardElementState;
  style?: AgentMessageCardElementStyle;
  agentSpeechAlignment?: ElevenLabsAudioAlignmentSnapshot | null;
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

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
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

function normalizeToMs(values: number[], maxThresholdForSeconds: number): number[] {
  if (!values.length) return [];
  const maxValue = Math.max(...values);
  if (maxValue <= maxThresholdForSeconds) {
    return values.map((value) => value * 1000);
  }
  return values;
}

function normalizeAlignment(raw: unknown): NormalizedAlignment | null {
  if (!raw || typeof raw !== 'object') return null;
  const payload = raw as Record<string, unknown>;

  const characters = toStringArray(payload.characters ?? payload.chars);
  if (!characters.length) return null;

  const startCandidates = normalizeToMs(
    toNumberArray(
      payload.char_start_times_ms
      ?? payload.charStartTimesMs
      ?? payload.character_start_times_ms
      ?? payload.characterStartTimesMs
      ?? payload.char_start_times
      ?? payload.charStartTimes
      ?? payload.character_start_times
      ?? payload.characterStartTimes
    ),
    120
  );
  const durationCandidates = normalizeToMs(
    toNumberArray(
      payload.char_durations_ms
      ?? payload.charDurationsMs
      ?? payload.character_durations_ms
      ?? payload.characterDurationsMs
      ?? payload.char_durations
      ?? payload.charDurations
      ?? payload.character_durations
      ?? payload.characterDurations
    ),
    20
  );

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

  if (!words.length) return null;

  return {
    text: characters.join(''),
    words,
  };
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
    return hasSufficientWordOverlap(data.message ?? '', normalizedAlignment.text);
  }, [data.message, normalizedAlignment, syncWithSpeech, totalWordCount]);

  const [elapsedSpeechMs, setElapsedSpeechMs] = useState<number | null>(null);
  const [fallbackElapsedSpeechMs, setFallbackElapsedSpeechMs] = useState<number | null>(null);
  const animationStartRef = useRef<number | null>(null);
  const fallbackAnimationStartRef = useRef<number | null>(null);
  const previousAlignmentTextRef = useRef<string>('');
  const previousAlignmentReceivedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldUseAlignment || !normalizedAlignment) {
      animationStartRef.current = null;
      previousAlignmentTextRef.current = '';
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
    const isContinuation =
      arrivedSoonAfterPrevious
      && previousAlignmentTextRef.current.length > 0
      && normalizedAlignment.text.startsWith(previousAlignmentTextRef.current);

    if (!isContinuation) {
      animationStartRef.current = performance.now();
      setElapsedSpeechMs(0);
    }

    previousAlignmentTextRef.current = normalizedAlignment.text;
    previousAlignmentReceivedAtRef.current = currentReceivedAt;
  }, [agentSpeechAlignment?.receivedAtMs, normalizedAlignment, shouldUseAlignment]);

  useEffect(() => {
    if (!shouldUseAlignment || !normalizedAlignment || totalWordCount === 0) return;

    let animationFrameId = 0;
    const tick = () => {
      const startedAt = animationStartRef.current ?? performance.now();
      if (animationStartRef.current === null) {
        animationStartRef.current = startedAt;
      }

      const elapsedMs = performance.now() - startedAt;
      const lastWordEndMs = normalizedAlignment.words[normalizedAlignment.words.length - 1]?.endMs ?? 0;
      setElapsedSpeechMs((currentValue) => {
        if (currentValue === null) return elapsedMs;
        if (Math.abs(currentValue - elapsedMs) < 16) return currentValue;
        return elapsedMs;
      });

      if (elapsedMs < lastWordEndMs + 140) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [normalizedAlignment, shouldUseAlignment, totalWordCount]);

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

    if (!shouldUseAlignment || !normalizedAlignment || elapsedSpeechMs === null) {
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

    const alignmentWordCount = normalizedAlignment.words.length;
    if (alignmentWordCount === 0) {
      return { opacity: 1, filter: 'blur(0px)' };
    }

    const mappedAlignmentWordIndex = totalWordCount <= 1
      ? 0
      : Math.min(
          alignmentWordCount - 1,
          Math.round((wordIndex / Math.max(totalWordCount - 1, 1)) * Math.max(alignmentWordCount - 1, 0))
        );
    const wordTiming = normalizedAlignment.words[mappedAlignmentWordIndex];
    if (!wordTiming) {
      return { opacity: 1, filter: 'blur(0px)' };
    }

    const revealDurationMs = Math.max(MIN_WORD_REVEAL_DURATION_MS, wordTiming.endMs - wordTiming.startMs);
    const revealProgress = clamp01((elapsedSpeechMs - wordTiming.startMs) / revealDurationMs);
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
