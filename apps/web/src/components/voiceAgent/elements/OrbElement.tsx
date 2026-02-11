import React, { useMemo, useRef } from 'react';
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
  small: { width: '108px', height: '108px' },
  medium: { width: '240px', height: '240px' },
  large: { width: '320px', height: '320px' },
};

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
  void canExpand;
  const inputVolumeRef = useRef<number>(inputVolume ?? 0);
  const outputVolumeRef = useRef<number>(outputVolume ?? 0);

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

  const defaultColors: [string, string] = ['#7E57FF', '#A487FF'];
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

  return (
    <div
      className="orb-element"
      style={containerStyle}
      data-element-id={data.id}
    >
      {orbNode}
    </div>
  );
};

export default OrbElement;
