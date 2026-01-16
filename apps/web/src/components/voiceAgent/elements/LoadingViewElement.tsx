import React from 'react';
import { LoadingViewElementState } from '../../../types/journey';
import './LoadingViewElement.css';

export interface LoadingViewElementProps {
  data: LoadingViewElementState;
}

export const LoadingViewElement: React.FC<LoadingViewElementProps> = ({
  data,
}) => {
  return (
    <div 
      className="loading-view-element"
      data-element-id={data.id}
    >
      <div className="loading-view-spinner">
        <div className="loading-view-spinner-circle"></div>
      </div>
    </div>
  );
};

export default LoadingViewElement;

