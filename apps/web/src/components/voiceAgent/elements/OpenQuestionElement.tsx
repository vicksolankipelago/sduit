import React, { useState, useEffect, useRef } from 'react';
import { useScreenContext } from '../../../contexts/voiceAgent/ScreenContext';
import { OpenQuestionElementState, OpenQuestionElementStyle } from '../../../types/journey';
import './OpenQuestionElement.css';

export interface OpenQuestionElementProps {
  data: OpenQuestionElementState;
  style?: OpenQuestionElementStyle;
  events?: any[];
  onEventTrigger?: (eventId: string) => void;
}

export const OpenQuestionElement: React.FC<OpenQuestionElementProps> = ({
  data,
  style: _style,
  events: _events,
  onEventTrigger: _onEventTrigger,
}) => {
  const { screenState, currentScreen } = useScreenContext();
  const [recordedTitle, setRecordedTitle] = useState<string | null>(null);
  const [recordedSummary, setRecordedSummary] = useState<string | null>(null);
  const [_recordedDescription, setRecordedDescription] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [questionMinimized, setQuestionMinimized] = useState(false);
  const [processedTimestamp, setProcessedTimestamp] = useState<number | null>(null);
  const currentScreenIdRef = useRef<string | null>(null);
  const elementIdRef = useRef<string>(data.id);
  const summaryShownAtRef = useRef<number | null>(null); // Track when summary was shown

  const coerceToText = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value && typeof value === 'object') {
      const textCandidate = (value as { text?: unknown }).text;
      if (typeof textCandidate === 'string') return textCandidate.trim();
    }
    return '';
  };

  // Reset state when screen changes or element ID changes
  useEffect(() => {
    const screenId = currentScreen?.id;
    const elementId = data.id;
    
    // Check if screen changed or element changed
    if (screenId && screenId !== currentScreenIdRef.current) {
      // Don't reset if we're currently showing a summary - let it finish displaying
      if (showSummary && summaryShownAtRef.current) {
        const timeSinceShown = Date.now() - summaryShownAtRef.current;
        if (timeSinceShown < 2000) {
          console.log('📝 OpenQuestionElement: Screen changed but summary still showing, delaying reset', {
            timeSinceShown,
            oldScreen: currentScreenIdRef.current,
            newScreen: screenId
          });
          // Update screen ref but don't reset state yet
          currentScreenIdRef.current = screenId;
          return;
        }
      }
      
      console.log('📝 OpenQuestionElement: Screen changed, resetting state', { 
        oldScreen: currentScreenIdRef.current, 
        newScreen: screenId 
      });
      currentScreenIdRef.current = screenId;
      // Reset all state when screen changes
      setRecordedTitle(null);
      setRecordedSummary(null);
      setRecordedDescription(null);
      setShowSummary(false);
      setQuestionMinimized(false);
      setProcessedTimestamp(null);
      summaryShownAtRef.current = null;
    } else if (elementId !== elementIdRef.current) {
      // Element changed (different question on same screen)
      console.log('📝 OpenQuestionElement: Element changed, resetting state', { 
        oldElement: elementIdRef.current, 
        newElement: elementId 
      });
      elementIdRef.current = elementId;
      setRecordedTitle(null);
      setRecordedSummary(null);
      setRecordedDescription(null);
      setShowSummary(false);
      setQuestionMinimized(false);
      setProcessedTimestamp(null);
      summaryShownAtRef.current = null;
    }
  }, [currentScreen?.id, data.id]);

  // Listen for screen state changes
  useEffect(() => {
    // Try to get values - they might be wrapped in .value or direct
    const titleRaw = screenState?.recordedInputTitle;
    const summaryRaw = screenState?.recordedInputSummary;
    const timestampRaw = screenState?.recordedInputTimestamp;
    const descriptionRaw = screenState?.recordedInputDescription;
    
    // Helper to safely extract value from AnyCodable
    const extractValue = (raw: unknown): unknown => {
      if (raw && typeof raw === 'object' && 'value' in raw) {
        return (raw as { value: unknown }).value;
      }
      return raw;
    };
    
    const title = extractValue(titleRaw) as string | undefined;
    const summary = extractValue(summaryRaw);
    const description = extractValue(descriptionRaw);
    const timestamp = extractValue(timestampRaw) as number | undefined;
    const summaryText = coerceToText(summary);
    const descriptionText = coerceToText(description);
    const displaySummary = summaryText || descriptionText;

    console.log('📝 OpenQuestionElement: State check', { 
      title, 
      summary: displaySummary,
      timestamp, 
      processedTimestamp,
      hasTitle: !!title,
      hasSummary: displaySummary.length > 0,
      timestampMatch: timestamp === processedTimestamp
    });

    // Only process if we have valid data
    if (title && displaySummary.length > 0) {
      // Use timestamp for deduplication if available, otherwise use title+summary combination
      const dedupeKey = timestamp ?? `${title}:${displaySummary}`;
      const currentDedupeKey = processedTimestamp ?? (recordedTitle && recordedSummary ? `${recordedTitle}:${recordedSummary}` : null);
      
      // Skip if we've already processed this exact update
      if (dedupeKey === currentDedupeKey) {
        console.log('📝 OpenQuestionElement: Skipping duplicate update', { dedupeKey });
        return;
      }
      
      console.log('📝 OpenQuestionElement: Processing record_input', { title, summary: displaySummary, timestamp, dedupeKey });
      
      // Use timestamp if available, otherwise use a numeric key based on title+summary
      setProcessedTimestamp(timestamp ?? Date.now());
      setRecordedTitle(title);
      setRecordedSummary(displaySummary);
      setRecordedDescription(descriptionText || null);

      // Animate and show summary immediately so captured input appears without UI lag.
      setQuestionMinimized(true);
      const now = Date.now();
      summaryShownAtRef.current = now;
      setShowSummary(true);

      console.log('📝 OpenQuestionElement: Summary shown at', now);

      // Navigation is controlled by the voice agent via trigger_event/record_input delays.
      // This component should only handle immediate visual state updates.
    }


  }, [screenState, processedTimestamp, recordedTitle, recordedSummary]);

  return (
    <div 
      className="open-question-element"
      data-element-id={data.id}
    >
      {showSummary && recordedTitle && recordedSummary ? (
        // Summary state - show title + captured text in a card
        <div className="open-question-summary">
          <div className="open-question-summary-card">
            <div className="open-question-title pelago-caption-2-regular">
              {recordedTitle}
            </div>
            <div className="open-question-summary-text pelago-header-2">
              {recordedSummary}
            </div>
          </div>
        </div>
      ) : (
        // Question state - show large question text
        <div 
          className={`open-question-text pelago-header-2 ${questionMinimized ? 'minimized' : ''}`}
        >
          {data.question}
        </div>
      )}
    </div>
  );
};

export default OpenQuestionElement;
