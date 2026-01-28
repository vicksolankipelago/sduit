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
  // Log when button is mounted/updated
  React.useEffect(() => {
    console.log('🔘 ButtonElement mounted/updated:', {
      id: data.id,
      title: data.title,
      events: events?.length || 0,
      hasOnEventTrigger: !!onEventTrigger,
    });
  }, [data.id, data.title, events, onEventTrigger]);

  const handleClick = () => {
    console.log('🔘 Button clicked:', data.id, 'disabled:', data.isDisabled, 'events:', events?.length || 0);
    alert(`Button "${data.title}" clicked!`); // Add alert for visual feedback
    
    if (data.isDisabled) return;
    
    // Trigger button tap/click events (support onSelected, onTap, and custom event types)
    const clickEvent = events?.find(e => 
      e.type === 'onSelected' || 
      e.type === 'onTap' || 
      e.type === 'custom'
    );
    
    console.log('🔘 Click event found:', clickEvent ? `${clickEvent.id} (${clickEvent.type})` : 'none');
    
    if (clickEvent && onEventTrigger) {
      console.log('🔘 Triggering event:', clickEvent.id);
      onEventTrigger(clickEvent.id);
    } else {
      console.log('⚠️ No event trigger or no matching event');
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

