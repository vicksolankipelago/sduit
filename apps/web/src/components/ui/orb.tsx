import React, { useEffect, useId, useRef } from "react";
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
const OUTER_RING_RADIUS = 34;
const INNER_FILL_RADIUS = 31.5;
const LINE_WIDTH = 2.9;
const NEEDLE_HALF_LENGTH = 11.8;
const NEEDLE_TIP_LENGTH = 2.9;
const NEEDLE_WING_DEPTH = 2.6;
const NEEDLE_WING_HALF_WIDTH = 1.5;
const CARDINAL_SPOKE_OUTER_RADIUS = 30.6;
const DIAGONAL_SPOKE_OUTER_RADIUS = 30.9;
const CARDINAL_SPOKE_BASE_LENGTH = 4.8;
const DIAGONAL_SPOKE_BASE_LENGTH = 3.1;
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

  const idBase = useId().replace(/:/g, "");
  const fillClipId = `navi-orb-fill-clip-${idBase}`;
  const fillGradientId = `navi-orb-fill-grad-${idBase}`;
  const fillLinearId = `navi-orb-fill-linear-${idBase}`;
  const fillBlurId = `navi-orb-fill-blur-${idBase}`;

  const fillGradientRef = useRef<SVGRadialGradientElement>(null);
  const needleLineRef = useRef<SVGLineElement>(null);
  const needleHeadRef = useRef<SVGPathElement>(null);
  const needleTailRef = useRef<SVGPathElement>(null);
  const tickRefs = useRef<Array<SVGLineElement | null>>([]);
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

      if (fillGradientRef.current) {
        const gradientX = CENTER - 4 + Math.sin(elapsed * 0.72) * (7.6 + energy * 2.3);
        const gradientY = CENTER - 7 + Math.cos(elapsed * 0.62) * (6.4 + energy * 1.9);
        const gradientRadius = OUTER_RING_RADIUS * (
          1 + Math.sin(elapsed * 0.9) * (0.08 + energy * 0.05)
        );
        fillGradientRef.current.setAttribute("cx", gradientX.toFixed(2));
        fillGradientRef.current.setAttribute("cy", gradientY.toFixed(2));
        fillGradientRef.current.setAttribute("r", gradientRadius.toFixed(2));
      }

      const angleRad = (clampedHeading * Math.PI) / 180;
      const dirX = Math.sin(angleRad);
      const dirY = -Math.cos(angleRad);
      const perpX = -dirY;
      const perpY = dirX;

      const topX = CENTER + dirX * NEEDLE_HALF_LENGTH;
      const topY = CENTER + dirY * NEEDLE_HALF_LENGTH;
      const bottomX = CENTER - dirX * NEEDLE_HALF_LENGTH;
      const bottomY = CENTER - dirY * NEEDLE_HALF_LENGTH;

      if (needleLineRef.current) {
        needleLineRef.current.setAttribute("x1", topX.toFixed(2));
        needleLineRef.current.setAttribute("y1", topY.toFixed(2));
        needleLineRef.current.setAttribute("x2", bottomX.toFixed(2));
        needleLineRef.current.setAttribute("y2", bottomY.toFixed(2));
        needleLineRef.current.setAttribute("opacity", (0.8 + energy * 0.2).toFixed(3));
      }

      const topTipX = topX + dirX * NEEDLE_TIP_LENGTH;
      const topTipY = topY + dirY * NEEDLE_TIP_LENGTH;
      const topLeftX = topX - dirX * NEEDLE_WING_DEPTH + perpX * NEEDLE_WING_HALF_WIDTH;
      const topLeftY = topY - dirY * NEEDLE_WING_DEPTH + perpY * NEEDLE_WING_HALF_WIDTH;
      const topRightX = topX - dirX * NEEDLE_WING_DEPTH - perpX * NEEDLE_WING_HALF_WIDTH;
      const topRightY = topY - dirY * NEEDLE_WING_DEPTH - perpY * NEEDLE_WING_HALF_WIDTH;
      if (needleHeadRef.current) {
        needleHeadRef.current.setAttribute(
          "d",
          `M ${topTipX.toFixed(2)} ${topTipY.toFixed(2)} L ${topLeftX.toFixed(2)} ${topLeftY.toFixed(2)} L ${topX.toFixed(2)} ${topY.toFixed(2)} L ${topRightX.toFixed(2)} ${topRightY.toFixed(2)} Z`,
        );
        needleHeadRef.current.setAttribute("opacity", (0.8 + energy * 0.2).toFixed(3));
      }

      const tailTipX = bottomX - dirX * NEEDLE_TIP_LENGTH;
      const tailTipY = bottomY - dirY * NEEDLE_TIP_LENGTH;
      const tailLeftX = bottomX + dirX * NEEDLE_WING_DEPTH + perpX * NEEDLE_WING_HALF_WIDTH;
      const tailLeftY = bottomY + dirY * NEEDLE_WING_DEPTH + perpY * NEEDLE_WING_HALF_WIDTH;
      const tailRightX = bottomX + dirX * NEEDLE_WING_DEPTH - perpX * NEEDLE_WING_HALF_WIDTH;
      const tailRightY = bottomY + dirY * NEEDLE_WING_DEPTH - perpY * NEEDLE_WING_HALF_WIDTH;
      if (needleTailRef.current) {
        needleTailRef.current.setAttribute(
          "d",
          `M ${tailTipX.toFixed(2)} ${tailTipY.toFixed(2)} L ${tailLeftX.toFixed(2)} ${tailLeftY.toFixed(2)} L ${bottomX.toFixed(2)} ${bottomY.toFixed(2)} L ${tailRightX.toFixed(2)} ${tailRightY.toFixed(2)} Z`,
        );
        needleTailRef.current.setAttribute("opacity", (0.8 + energy * 0.2).toFixed(3));
      }

      const pulseSpeed =
        state === "talking" ? 4.4 : state === "listening" ? 3.6 : state === "thinking" ? 2.4 : 1.8;
      for (let index = 0; index < 8; index += 1) {
        const tickNode = tickRefs.current[index];
        if (!tickNode) continue;

        const isCardinal = index % 2 === 0;
        const angle = (index / 8) * Math.PI * 2;
        const outerRadius = isCardinal ? CARDINAL_SPOKE_OUTER_RADIUS : DIAGONAL_SPOKE_OUTER_RADIUS;
        const baseLength = isCardinal ? CARDINAL_SPOKE_BASE_LENGTH : DIAGONAL_SPOKE_BASE_LENGTH;
        const localPulse = 0.5 + 0.5 * Math.sin(elapsed * pulseSpeed + index * 0.86);
        const lengthBoost = isCardinal ? 2.0 : 1.2;
        const dynamicLength = baseLength + lengthBoost * localPulse * (0.45 + energy * 0.8);
        const innerRadius = outerRadius - dynamicLength;

        const x1 = CENTER + Math.cos(angle) * innerRadius;
        const y1 = CENTER + Math.sin(angle) * innerRadius;
        const x2 = CENTER + Math.cos(angle) * outerRadius;
        const y2 = CENTER + Math.sin(angle) * outerRadius;

        tickNode.setAttribute("x1", x1.toFixed(2));
        tickNode.setAttribute("y1", y1.toFixed(2));
        tickNode.setAttribute("x2", x2.toFixed(2));
        tickNode.setAttribute("y2", y2.toFixed(2));
        tickNode.setAttribute("opacity", (0.34 + localPulse * 0.42).toFixed(3));
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

  // Keep the compass palette fixed to the requested purple style.
  const strokeColor = DEFAULT_COLORS[0];
  const accentColor = DEFAULT_COLORS[1];
  void colorsRef;
  void colorsLiveRef;
  const orbStyle: React.CSSProperties & Record<
    "--navi-orb-stroke" |
    "--navi-orb-accent" |
    "--navi-orb-line-width" |
    "--navi-orb-ink" |
    "--navi-orb-fill-core" |
    "--navi-orb-fill-mid" |
    "--navi-orb-fill-edge" |
    "--navi-orb-fill-glow-a" |
    "--navi-orb-fill-glow-b",
    string
  > = {
    "--navi-orb-stroke": strokeColor,
    "--navi-orb-accent": accentColor,
    "--navi-orb-line-width": `${LINE_WIDTH}px`,
    "--navi-orb-ink": "#FFFFFF",
    "--navi-orb-fill-core": "#3E5EFF",
    "--navi-orb-fill-mid": "#6D64FF",
    "--navi-orb-fill-edge": "#C77BFF",
    "--navi-orb-fill-glow-a": "rgba(91, 119, 255, 0.75)",
    "--navi-orb-fill-glow-b": "rgba(215, 117, 238, 0.62)",
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
        <defs>
          <clipPath id={fillClipId}>
            <circle cx={CENTER} cy={CENTER} r={INNER_FILL_RADIUS} />
          </clipPath>
          <radialGradient
            id={fillGradientId}
            ref={fillGradientRef}
            gradientUnits="userSpaceOnUse"
            cx={CENTER - 4}
            cy={CENTER - 7}
            r={OUTER_RING_RADIUS}
          >
            <stop offset="0%" stopColor="var(--navi-orb-fill-core, #3e5eff)" stopOpacity="0.95" />
            <stop offset="58%" stopColor="var(--navi-orb-fill-mid, #6d64ff)" stopOpacity="0.88" />
            <stop offset="100%" stopColor="var(--navi-orb-fill-edge, #c77bff)" stopOpacity="0.62" />
          </radialGradient>
          <linearGradient id={fillLinearId} x1="12%" y1="16%" x2="86%" y2="88%">
            <stop offset="0%" stopColor="var(--navi-orb-fill-glow-a, rgba(91, 119, 255, 0.75))" />
            <stop offset="100%" stopColor="var(--navi-orb-fill-glow-b, rgba(215, 117, 238, 0.62))" />
          </linearGradient>
          <filter id={fillBlurId} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="4.2" />
          </filter>
        </defs>

        <g className="navi-orb-fill-layer" clipPath={`url(#${fillClipId})`}>
          <circle
            className="navi-orb-fill-base"
            cx={CENTER}
            cy={CENTER}
            r={INNER_FILL_RADIUS}
            fill={`url(#${fillGradientId})`}
          />
          <ellipse
            className="navi-orb-fill-glow navi-orb-fill-glow-a"
            cx={CENTER - 9}
            cy={CENTER - 5}
            rx="18"
            ry="16"
            fill={`url(#${fillLinearId})`}
            filter={`url(#${fillBlurId})`}
          />
          <ellipse
            className="navi-orb-fill-glow navi-orb-fill-glow-b"
            cx={CENTER + 8}
            cy={CENTER + 7}
            rx="16"
            ry="14"
            fill={`url(#${fillLinearId})`}
            filter={`url(#${fillBlurId})`}
          />
        </g>

        <circle className="navi-orb-shell" cx={CENTER} cy={CENTER} r={OUTER_RING_RADIUS} />
        <circle className="navi-orb-shell-shimmer" cx={CENTER} cy={CENTER} r={OUTER_RING_RADIUS} />
        <g className="navi-orb-ticks">
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            const isCardinal = index % 2 === 0;
            const outer = isCardinal ? CARDINAL_SPOKE_OUTER_RADIUS : DIAGONAL_SPOKE_OUTER_RADIUS;
            const baseLength = isCardinal ? CARDINAL_SPOKE_BASE_LENGTH : DIAGONAL_SPOKE_BASE_LENGTH;
            const inner = outer - baseLength;
            const x1 = CENTER + Math.cos(angle) * inner;
            const y1 = CENTER + Math.sin(angle) * inner;
            const x2 = CENTER + Math.cos(angle) * outer;
            const y2 = CENTER + Math.sin(angle) * outer;

            return (
              <line
                key={`tick-${index}`}
                ref={(node) => {
                  tickRefs.current[index] = node;
                }}
                x1={x1.toFixed(2)}
                y1={y1.toFixed(2)}
                x2={x2.toFixed(2)}
                y2={y2.toFixed(2)}
              />
            );
          })}
        </g>

        <g className="navi-orb-needle">
          <line ref={needleLineRef} className="navi-orb-needle-line" x1="50" y1="27" x2="50" y2="73" />
          <path ref={needleHeadRef} className="navi-orb-needle-head" d="M50 21 L45 30 L50 27 L55 30 Z" />
          <path ref={needleTailRef} className="navi-orb-needle-tail" d="M50 79 L46.8 71 L50 73 L53.2 71 Z" />
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
