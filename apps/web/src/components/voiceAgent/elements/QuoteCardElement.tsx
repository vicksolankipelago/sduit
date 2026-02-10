import React from 'react';
import { QuoteCardElementState, QuoteCardElementStyle } from '../../../types/journey';
import './QuoteCardElement.css';

export interface QuoteCardElementProps {
  data: QuoteCardElementState;
  style?: QuoteCardElementStyle;
}

export const QuoteCardElement: React.FC<QuoteCardElementProps> = ({
  data,
  style,
}) => {
  // Support both "caption" (new) and "jobTitle" (legacy)
  const caption = data.caption ?? (data as any).jobTitle;

  return (
    <div
      className={`quote-card-element ${style?.imageName ? '' : 'quote-card-no-image'}`}
      data-element-id={data.id}
    >
      {style?.imageName && (
        <img
          src={`/assets/images/${style.imageName}.png`}
          alt="Quote author"
          className="quote-card-image"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      )}
      <div className="quote-card-content">
        <div className="quote-card-message pelago-body-1-regular">
          {data.message}
        </div>
        {caption && (
          <div className="quote-card-author pelago-body-2-regular">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteCardElement;

