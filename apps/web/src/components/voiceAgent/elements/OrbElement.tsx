import React, { useRef } from 'react';
import { OrbData, OrbElementStyle } from '../../../types/journey';
import { Orb, AgentState } from '../../ui/orb';
import './OrbElement.css';

export interface OrbElementProps {
  data: OrbData;
  style?: OrbElementStyle;
  /** External input volume (0-1) for manual mode */
  inputVolume?: number;
  /** External output volume (0-1) for manual mode */
  outputVolume?: number;
  /** Callback to get current input volume (for real-time updates) */
  getInputVolume?: () => number;
  /** Callback to get current output volume (for real-time updates) */
  getOutputVolume?: () => number;
}

const SIZE_MAP = {
  small: { width: '120px', height: '120px' },
  medium: { width: '200px', height: '200px' },
  large: { width: '300px', height: '300px' },
};

export const OrbElement: React.FC<OrbElementProps> = ({
  data,
  style,
  inputVolume,
  outputVolume,
  getInputVolume,
  getOutputVolume,
}) => {
  const inputVolumeRef = useRef<number>(inputVolume ?? 0);
  const outputVolumeRef = useRef<number>(outputVolume ?? 0);

  // Update refs when props change
  React.useEffect(() => {
    if (inputVolume !== undefined) {
      inputVolumeRef.current = inputVolume;
    }
  }, [inputVolume]);

  React.useEffect(() => {
    if (outputVolume !== undefined) {
      outputVolumeRef.current = outputVolume;
    }
  }, [outputVolume]);

  // Determine size from style
  const sizeStyle = style?.size ? SIZE_MAP[style.size] : SIZE_MAP.medium;

  const containerStyle: React.CSSProperties = {
    width: style?.width || sizeStyle.width,
    height: style?.height || sizeStyle.height,
    backgroundColor: style?.backgroundColor || 'transparent',
  };

  // Default colors matching Pelago design system
  const defaultColors: [string, string] = ['#A2CC6E', '#DDF1C4']; // mint-green to tea-green
  const colors = data.colors || defaultColors;

  return (
    <div
      className="orb-element"
      style={containerStyle}
      data-element-id={data.id}
    >
      <Orb
        colors={colors}
        seed={data.seed}
        agentState={(data.agentState as AgentState) ?? null}
        volumeMode={data.volumeMode || 'auto'}
        inputVolumeRef={inputVolumeRef}
        outputVolumeRef={outputVolumeRef}
        getInputVolume={getInputVolume}
        getOutputVolume={getOutputVolume}
        className="orb-canvas"
      />
    </div>
  );
};

export default OrbElement;
