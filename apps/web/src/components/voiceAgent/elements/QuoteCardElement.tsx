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
  return (
    <div
      className="quote-card-element"
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
        <div className="quote-card-message pelago-body-2-serif">
          "{data.message}"
        </div>
        {data.jobTitle && (
          <div className="quote-card-author pelago-caption-2-bold">
            {data.jobTitle}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteCardElement;

