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

  const [visibleWordCount, setVisibleWordCount] = useState(totalWordCount);
  const animationStartRef = useRef<number | null>(null);
  const previousAlignmentTextRef = useRef<string>('');
  const previousAlignmentReceivedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldUseAlignment || !normalizedAlignment) {
      animationStartRef.current = null;
      previousAlignmentTextRef.current = '';
      previousAlignmentReceivedAtRef.current = null;
      setVisibleWordCount(totalWordCount);
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
      setVisibleWordCount(0);
    }

    previousAlignmentTextRef.current = normalizedAlignment.text;
    previousAlignmentReceivedAtRef.current = currentReceivedAt;
  }, [agentSpeechAlignment?.receivedAtMs, normalizedAlignment, shouldUseAlignment, totalWordCount]);

  useEffect(() => {
    if (!shouldUseAlignment || !normalizedAlignment || totalWordCount === 0) return;

    let animationFrameId = 0;
    const tick = () => {
      const startedAt = animationStartRef.current ?? performance.now();
      if (animationStartRef.current === null) {
        animationStartRef.current = startedAt;
      }

      const elapsedMs = performance.now() - startedAt;
      let visibleAlignedWords = 0;

      for (const word of normalizedAlignment.words) {
        if (elapsedMs >= word.endMs) {
          visibleAlignedWords += 1;
        } else {
          break;
        }
      }

      const progress = normalizedAlignment.words.length > 0
        ? Math.min(1, visibleAlignedWords / normalizedAlignment.words.length)
        : 1;
      const nextVisibleWordCount = Math.max(0, Math.min(totalWordCount, Math.ceil(progress * totalWordCount)));

      setVisibleWordCount((currentValue) => (currentValue === nextVisibleWordCount ? currentValue : nextVisibleWordCount));

      if (progress < 1) {
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
      <div className="agent-message-card-message pelago-body-1-regular">
        {messageTokens.map((token, tokenIndex) => {
          if (token.isWhitespace) {
            return (
              <React.Fragment key={`space-${tokenIndex}`}>
                {token.text}
              </React.Fragment>
            );
          }

          const isVisible = token.wordIndex !== null && token.wordIndex < visibleWordCount;
          return (
            <span
              key={`word-${tokenIndex}`}
              className={`agent-message-card-word ${isVisible ? 'visible' : 'hidden'}`}
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
