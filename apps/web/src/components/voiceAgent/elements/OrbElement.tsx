import React, { useMemo, useRef, useState } from 'react';
import { OrbData, OrbElementStyle } from '../../../types/journey';
import { Orb, AgentState } from '../../ui/orb';
import './OrbElement.css';

type ActiveSpeaker = 'agent' | 'member' | 'none';

export interface OrbElementProps {
  data: OrbData;
  style?: OrbElementStyle;
  inputVolume?: number;
  outputVolume?: number;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  activeSpeaker?: ActiveSpeaker;
  memberAudioLevel?: number;
  sessionConnected?: boolean;
  canExpand?: boolean;
}

const SIZE_MAP = {
  small: { width: '88px', height: '88px' },
  medium: { width: '196px', height: '196px' },
  large: { width: '304px', height: '304px' },
};

const EXPANDED_SIZE = 'min(72vw, 340px)';

export const OrbElement: React.FC<OrbElementProps> = ({
  data,
  style,
  inputVolume,
  outputVolume,
  getInputVolume,
  getOutputVolume,
  activeSpeaker,
  memberAudioLevel,
  sessionConnected,
  canExpand = true,
}) => {
  const inputVolumeRef = useRef<number>(inputVolume ?? 0);
  const outputVolumeRef = useRef<number>(outputVolume ?? 0);
  const [isExpanded, setIsExpanded] = useState(false);

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

  const sizeStyle = style?.size ? SIZE_MAP[style.size] : SIZE_MAP.medium;

  const containerStyle: React.CSSProperties = {
    width: style?.width || sizeStyle.width,
    height: style?.height || sizeStyle.height,
    backgroundColor: style?.backgroundColor || 'transparent',
  };

  const expandedContainerStyle: React.CSSProperties = {
    width: EXPANDED_SIZE,
    height: EXPANDED_SIZE,
  };

  const defaultColors: [string, string] = ['#FAE355', '#FEF7CE'];
  const colors = data.colors || defaultColors;

  const runtimeAgentState = useMemo<AgentState>(() => {
    if (activeSpeaker === 'agent') return 'talking';
    if (activeSpeaker === 'member') return 'listening';
    if (sessionConnected) return 'thinking';
    return (data.agentState as AgentState) ?? null;
  }, [activeSpeaker, data.agentState, sessionConnected]);

  const shouldUseManualInput = activeSpeaker === 'member' && typeof memberAudioLevel === 'number';
  const runtimeVolumeMode = shouldUseManualInput ? 'manual' : (data.volumeMode || 'auto');

  const manualInputVolume = shouldUseManualInput
    ? Math.max(0, Math.min(memberAudioLevel ?? 0, 1))
    : inputVolume;

  const orbNode = (
    <Orb
      colors={colors}
      seed={data.seed}
      agentState={runtimeAgentState}
      volumeMode={runtimeVolumeMode}
      manualInput={manualInputVolume}
      manualOutput={outputVolume}
      inputVolumeRef={inputVolumeRef}
      outputVolumeRef={outputVolumeRef}
      getInputVolume={getInputVolume}
      getOutputVolume={getOutputVolume}
      className="orb-canvas"
    />
  );

  if (!canExpand) {
    return (
      <div
        className="orb-element"
        style={containerStyle}
        data-element-id={data.id}
      >
        {orbNode}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="orb-element orb-element-button"
        style={containerStyle}
        data-element-id={data.id}
        onClick={() => setIsExpanded(true)}
        aria-label="Open Navi voice animation"
      >
        {orbNode}
      </button>

      {isExpanded && (
        <div className="orb-element-overlay" onClick={() => setIsExpanded(false)}>
          <div className="orb-element-overlay-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="orb-element-overlay-close"
              onClick={() => setIsExpanded(false)}
              aria-label="Close Navi animation"
            >
              x
            </button>

            <div className="orb-element orb-element-expanded" style={expandedContainerStyle}>
              <Orb
                colors={colors}
                seed={data.seed}
                agentState={runtimeAgentState}
                volumeMode={runtimeVolumeMode}
                manualInput={manualInputVolume}
                manualOutput={outputVolume}
                inputVolumeRef={inputVolumeRef}
                outputVolumeRef={outputVolumeRef}
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
                className="orb-canvas"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrbElement;
