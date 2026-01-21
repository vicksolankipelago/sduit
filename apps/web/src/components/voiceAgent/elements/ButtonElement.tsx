import { ButtonElementState, ButtonElementStyle, ScreenEvent } from '../../../types/journey';
import './ButtonElement.css';

export interface ButtonElementProps {
  data: ButtonElementState;
  style: ButtonElementStyle;
  events?: ScreenEvent[];
  onEventTrigger?: (eventId: string) => void;
}

export const ButtonElement: React.FC<ButtonElementProps> = ({
  data,
  style,
  events,
  onEventTrigger,
}) => {
  const handleClick = () => {
    if (data.isDisabled) return;
    
    // Trigger onSelected event
    const selectEvent = events?.find(e => e.type === 'onSelected');
    if (selectEvent && onEventTrigger) {
      onEventTrigger(selectEvent.id);
    }
  };

  const getButtonClassName = (): string => {
    const baseClass = 'button-element';
    const styleClass = `button-element-${style.style}`;
    const sizeClass = `button-element-${style.size}`;
    const disabledClass = data.isDisabled ? 'button-element-disabled' : '';
    
    return `${baseClass} ${styleClass} ${sizeClass} ${disabledClass}`.trim();
  };

  const getFontClassName = (): string => {
    return style.size === 'large' ? 'pelago-button-1-bold' : 'pelago-button-2-bold';
  };

  return (
    <button
      className={getButtonClassName()}
      onClick={handleClick}
      disabled={data.isDisabled}
      data-element-id={data.id}
    >
      <span className={getFontClassName()}>
        {data.title}
      </span>
    </button>
  );
};

export default ButtonElement;

