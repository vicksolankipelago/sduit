import React, { useState, useCallback } from 'react';
import { ChipsGroupData, ChipsGroupElementStyle, ScreenEvent } from '../../../types/journey';
import './ChipsGroupElement.css';

export interface ChipsGroupElementProps {
  data: ChipsGroupData;
  style?: ChipsGroupElementStyle;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
  onMultiSelectToggle?: (optionId: string, isSelected: boolean) => void;
}

// Small checkbox indicator matching iOS ChipsButton (12x12 checkbox)
const ChipCheckbox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <svg
    className="chips-group-chip-checkbox"
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {checked ? (
      <>
        <rect width="14" height="14" rx="3" fill="#212633" />
        <path
          d="M3.5 7L6 9.5L10.5 5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ) : (
      <rect x="0.5" y="0.5" width="13" height="13" rx="2.5" stroke="#E0E0E0" fill="none" />
    )}
  </svg>
);

export const ChipsGroupElement: React.FC<ChipsGroupElementProps> = ({
  data,
  events,
  onEventTrigger,
  onMultiSelectToggle,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());

  const isMaxReached = selectedOptions.size >= data.maxSelection;

  const emitUiResponse = useCallback((selected: string[]) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('uiUserResponse', {
      detail: {
        text: selected.length > 0
          ? `I selected: ${selected.join(', ')}`
          : 'I cleared my selections',
        source: 'chipsGroup',
        metadata: {
          elementId: data.id,
          selectedOptions: selected,
        },
      },
    }));
  }, [data.id]);

  const handleChipToggle = useCallback((option: string) => {
    setSelectedOptions(prev => {
      const next = new Set(prev);
      const isCurrentlySelected = next.has(option);

      if (isCurrentlySelected) {
        next.delete(option);
      } else if (next.size < data.maxSelection) {
        next.add(option);
      } else {
        return prev; // Max reached, don't toggle
      }

      const newIsSelected = !isCurrentlySelected;
      const selectedArray = Array.from(next);

      // Update screenState.selectedOptions via parent
      if (onMultiSelectToggle) {
        onMultiSelectToggle(option, newIsSelected);
      }

      // Emit voice response
      emitUiResponse(selectedArray);

      // Trigger events
      const event = events?.find(e => e.type === 'onSelected' || e.type === 'custom');
      if (event && onEventTrigger) {
        onEventTrigger(event.id);
      }

      return next;
    });
  }, [data.maxSelection, events, onEventTrigger, onMultiSelectToggle, emitUiResponse]);

  const options = data.options || [];

  return (
    <div className="chips-group-element" data-element-id={data.id}>
      {options.map((option) => {
        const isSelected = selectedOptions.has(option);
        const isDisabled = !isSelected && isMaxReached;

        const chipClassName = [
          'chips-group-chip',
          isSelected && 'chips-group-chip-selected',
          isDisabled && 'chips-group-chip-disabled',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={option}
            type="button"
            className={chipClassName}
            onClick={() => !isDisabled && handleChipToggle(option)}
            disabled={isDisabled}
          >
            <ChipCheckbox checked={isSelected} />
            <span className="chips-group-chip-label pelago-body-2-bold">
              {option}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ChipsGroupElement;
