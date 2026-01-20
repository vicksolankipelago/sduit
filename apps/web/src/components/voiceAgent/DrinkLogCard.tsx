import './DrinkLogCard.css';

interface DrinkLogCardProps {
  drinkType: string;
  amount: number;
  frequency: string;
  standardUnits: number;
  runningTotal: number;
  onDismiss: () => void;
  id?: string;
}

export default function DrinkLogCard({ 
  drinkType,
  amount,
  frequency,
  standardUnits,
  runningTotal,
  onDismiss,
}: DrinkLogCardProps) {
  const getDrinkInfo = (drinkType: string) => {
    switch (drinkType) {
      case 'beer': return { title: 'Beer', emoji: '🍺' };
      case 'wine': return { title: 'Wine', emoji: '🍷' };
      case 'hard_liquor': return { title: 'Hard Liquor', emoji: '🥃' };
      case 'cocktail': return { title: 'Cocktail', emoji: '🍹' };
      default: return { title: 'Drink', emoji: '🥤' };
    }
  };

  const formatFrequency = (frequency: string) => {
    return frequency.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const drinkInfo = getDrinkInfo(drinkType);

  return (
    <div 
      className="drink-log-card"
      role="dialog"
      aria-label={`Drink logged: ${amount} ${drinkInfo.title}`}
    >
      <div className="drink-log-content">
        <div className="drink-log-icon">
          {drinkInfo.emoji}
        </div>
        <div className="drink-log-info">
          <div className="drink-log-header">
            <h3 className="drink-log-title">Drink Logged</h3>
            <span className="drink-log-badge">✓ Added</span>
          </div>
          
          <div className="drink-log-details">
            <div className="drink-log-row">
              <span className="drink-log-label">Type:</span>
              <span className="drink-log-value">{amount}x {drinkInfo.title}</span>
            </div>
            <div className="drink-log-row">
              <span className="drink-log-label">Frequency:</span>
              <span className="drink-log-value">{formatFrequency(frequency)}</span>
            </div>
            <div className="drink-log-row">
              <span className="drink-log-label">Standard units:</span>
              <span className="drink-log-value drink-log-highlight">{standardUnits}</span>
            </div>
            <div className="drink-log-divider"></div>
            <div className="drink-log-row">
              <span className="drink-log-label-bold">Weekly total:</span>
              <span className="drink-log-value-bold">{runningTotal} units</span>
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="drink-log-close"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
