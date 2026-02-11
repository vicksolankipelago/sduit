import React, { useEffect, useRef } from "react";
import "./orb.css";

export type AgentState = null | "thinking" | "listening" | "talking";

type OrbProps = {
  colors?: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  resizeDebounce?: number;
  seed?: number;
  agentState?: AgentState;
  volumeMode?: "auto" | "manual";
  manualInput?: number;
  manualOutput?: number;
  inputVolumeRef?: React.RefObject<number>;
  outputVolumeRef?: React.RefObject<number>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  className?: string;
};

const DEFAULT_COLORS: [string, string] = ["#7E57FF", "#A487FF"];
const VIEWBOX_SIZE = 100;
const CENTER = VIEWBOX_SIZE / 2;
const MIN_NEEDLE_DEGREES = -68;
const MAX_NEEDLE_DEGREES = 68;

export function Orb({
  colors = DEFAULT_COLORS,
  colorsRef,
  resizeDebounce = 100,
  seed,
  agentState = null,
  volumeMode = "auto",
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
  className,
}: OrbProps) {
  void resizeDebounce;
  void seed;

  const needleRef = useRef<SVGGElement>(null);
  const stateRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInputRef = useRef(clamp01(manualInput ?? 0));
  const manualOutputRef = useRef(clamp01(manualOutput ?? 0));
  const colorsLiveRef = useRef<[string, string]>(colors);
  const smoothInputRef = useRef(0);
  const smoothOutputRef = useRef(0);
  const smoothNeedleRef = useRef(0);

  useEffect(() => {
    stateRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    modeRef.current = volumeMode;
  }, [volumeMode]);

  useEffect(() => {
    manualInputRef.current = clamp01(
      manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0,
    );
  }, [manualInput, inputVolumeRef, getInputVolume]);

  useEffect(() => {
    manualOutputRef.current = clamp01(
      manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0,
    );
  }, [manualOutput, outputVolumeRef, getOutputVolume]);

  useEffect(() => {
    colorsLiveRef.current = colors;
  }, [colors]);

  useEffect(() => {
    let frameId = 0;
    let start = performance.now();
    let previous = start;

    const animate = (timestamp: number) => {
      const elapsed = (timestamp - start) / 1000;
      const deltaSeconds = Math.max(0.001, (timestamp - previous) / 1000);
      previous = timestamp;

      let targetInput = 0;
      let targetOutput = 0;
      const state = stateRef.current;

      if (modeRef.current === "manual") {
        targetInput = readVolume(
          manualInput,
          manualInputRef,
          inputVolumeRef,
          getInputVolume,
        );
        targetOutput = readVolume(
          manualOutput,
          manualOutputRef,
          outputVolumeRef,
          getOutputVolume,
        );
      } else {
        const auto = getAutoLevels(state, elapsed);
        targetInput = auto.input;
        targetOutput = auto.output;
      }

      const smoothing = Math.min(1, deltaSeconds * 10);
      smoothInputRef.current += (targetInput - smoothInputRef.current) * smoothing;
      smoothOutputRef.current += (targetOutput - smoothOutputRef.current) * smoothing;

      const targetNeedle = getNeedleTargetDegrees(
        elapsed,
        state,
        smoothInputRef.current,
        smoothOutputRef.current,
      );

      const needleLerp = Math.min(1, deltaSeconds * 7.5);
      smoothNeedleRef.current += (targetNeedle - smoothNeedleRef.current) * needleLerp;

      const clampedHeading = clamp(
        smoothNeedleRef.current,
        MIN_NEEDLE_DEGREES,
        MAX_NEEDLE_DEGREES,
      );
      const energy = clamp01((smoothInputRef.current * 0.72) + (smoothOutputRef.current * 0.48));
      const needleScale = 1 + energy * 0.04;

      if (needleRef.current) {
        needleRef.current.setAttribute(
          "transform",
          `translate(${CENTER} ${CENTER}) rotate(${clampedHeading.toFixed(2)}) scale(${needleScale.toFixed(3)}) translate(${-CENTER} ${-CENTER})`,
        );
        needleRef.current.setAttribute("opacity", (0.8 + energy * 0.2).toFixed(3));
      }

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    getInputVolume,
    getOutputVolume,
    inputVolumeRef,
    manualInput,
    manualOutput,
    outputVolumeRef,
  ]);

  const runtimeColors = colorsRef?.current ?? colorsLiveRef.current ?? DEFAULT_COLORS;
  const strokeColor = normalizeColor(runtimeColors[0], DEFAULT_COLORS[0]);
  const accentColor = normalizeColor(runtimeColors[1], strokeColor);
  const orbStyle: React.CSSProperties & Record<"--navi-orb-stroke" | "--navi-orb-accent", string> = {
    "--navi-orb-stroke": strokeColor,
    "--navi-orb-accent": accentColor,
  };

  return (
    <div className={className ?? "navi-orb-root"}>
      <svg
        className="navi-orb-svg"
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="img"
        aria-label="Compass"
        style={orbStyle}
      >
        <circle className="navi-orb-shell" cx={CENTER} cy={CENTER} r="34" />
        <circle className="navi-orb-shell-secondary" cx={CENTER} cy={CENTER} r="28" />

        <g className="navi-orb-ticks">
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            const isCardinal = index % 2 === 0;
            const inner = isCardinal ? 36 : 37;
            const outer = isCardinal ? 42 : 40;
            const x1 = CENTER + Math.cos(angle) * inner;
            const y1 = CENTER + Math.sin(angle) * inner;
            const x2 = CENTER + Math.cos(angle) * outer;
            const y2 = CENTER + Math.sin(angle) * outer;

            return (
              <line
                key={`tick-${index}`}
                x1={x1.toFixed(2)}
                y1={y1.toFixed(2)}
                x2={x2.toFixed(2)}
                y2={y2.toFixed(2)}
              />
            );
          })}
        </g>

        <g ref={needleRef} className="navi-orb-needle">
          <line className="navi-orb-needle-line" x1="50" y1="27" x2="50" y2="73" />
          <path className="navi-orb-needle-head" d="M50 21 L45 30 L50 27 L55 30 Z" />
          <path className="navi-orb-needle-tail" d="M50 79 L46.8 71 L50 73 L53.2 71 Z" />
          <circle className="navi-orb-needle-cap" cx="50" cy="50" r="3.4" />
        </g>
      </svg>
    </div>
  );
}

function getAutoLevels(state: AgentState, elapsed: number): { input: number; output: number } {
  if (state === "talking") {
    return {
      input: 0.16 + 0.04 * Math.sin(elapsed * 0.9),
      output: 0.56 + 0.2 * Math.sin(elapsed * 2.6),
    };
  }

  if (state === "listening") {
    return {
      input: 0.34 + 0.35 * Math.max(0, Math.sin(elapsed * 3.4)),
      output: 0.12,
    };
  }

  if (state === "thinking") {
    return {
      input: 0.16 + 0.06 * Math.sin(elapsed * 1.1),
      output: 0.2 + 0.08 * Math.sin(elapsed * 1.3),
    };
  }

  return { input: 0.08, output: 0.08 };
}

function getNeedleTargetDegrees(
  elapsed: number,
  state: AgentState,
  inputLevel: number,
  outputLevel: number,
): number {
  if (state === "talking") {
    return (
      Math.sin(elapsed * 1.1) * 22 +
      Math.sin(elapsed * 2.1) * 8 +
      outputLevel * 14
    );
  }

  if (state === "listening") {
    return (
      Math.sin(elapsed * 1.7) * 20 +
      Math.sin(elapsed * 4.2) * (8 + inputLevel * 24)
    );
  }

  if (state === "thinking") {
    return Math.sin(elapsed * 0.8) * 12;
  }

  return Math.sin(elapsed * 0.55) * 6;
}

function readVolume(
  manualValue: number | undefined,
  manualRef: React.MutableRefObject<number>,
  liveRef?: React.RefObject<number>,
  getter?: () => number,
): number {
  const value = manualValue ?? manualRef.current ?? liveRef?.current ?? getter?.() ?? 0;
  return clamp01(value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeColor(color: string | undefined, fallback: string): string {
  if (!color || !color.trim()) return fallback;
  return color;
}
