import React, { useState } from 'react';
import { CircularStepperElementState, ScreenEvent } from '../../../types/journey';
import './CircularStepperElement.css';

export interface CircularStepperElementProps {
  data: CircularStepperElementState;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
}

export const CircularStepperElement: React.FC<CircularStepperElementProps> = ({
  data,
  events,
  onEventTrigger,
}) => {
  const [value, setValue] = useState(data.value);

  const handleIncrement = () => {
    if (value < data.maxValue) {
      const newValue = value + data.step;
      setValue(newValue);
      triggerEvent();
    }
  };

  const handleDecrement = () => {
    if (value > data.minValue) {
      const newValue = value - data.step;
      setValue(newValue);
      triggerEvent();
    }
  };

  const triggerEvent = () => {
    const event = events?.find(e => e.type === 'onSelected');
    if (event && onEventTrigger) {
      onEventTrigger(event.id);
    }
  };

  return (
    <div className="circular-stepper-element" data-element-id={data.id}>
      <button
        className="circular-stepper-button"
        onClick={handleDecrement}
        disabled={value <= data.minValue}
      >
        −
      </button>
      <div className="circular-stepper-value">
        <div className="circular-stepper-number pelago-header-1">{value}</div>
        {data.label && (
          <div className="circular-stepper-label pelago-body-2-regular">{data.label}</div>
        )}
      </div>
      <button
        className="circular-stepper-button"
        onClick={handleIncrement}
        disabled={value >= data.maxValue}
      >
        +
      </button>
    </div>
  );
};

export default CircularStepperElement;

