import React, { useEffect, useId, useMemo, useRef } from "react";
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

const DEFAULT_COLORS: [string, string] = ["#FAE355", "#FEF7CE"];
const STROKE_COLOR = "#1A1A1A";
const VIEWBOX_SIZE = 100;
const CENTER = VIEWBOX_SIZE / 2;

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

  const outerBlobRef = useRef<SVGPathElement>(null);
  const innerBlobRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const ringOneRef = useRef<SVGCircleElement>(null);
  const ringTwoRef = useRef<SVGCircleElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const tickGroupRef = useRef<SVGGElement>(null);
  const primaryStopRef = useRef<SVGStopElement>(null);
  const middleStopRef = useRef<SVGStopElement>(null);
  const edgeStopRef = useRef<SVGStopElement>(null);

  const normalizedGradientId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const blobGradientId = `navi-blob-${normalizedGradientId}`;
  const ringGradientId = `navi-ring-${normalizedGradientId}`;

  const stateRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInputRef = useRef(clamp01(manualInput ?? 0));
  const manualOutputRef = useRef(clamp01(manualOutput ?? 0));
  const colorsLiveRef = useRef<[string, string]>(colors);

  const smoothInputRef = useRef(0.08);
  const smoothOutputRef = useRef(0.14);

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

  const random = useMemo(
    () => splitmix32(seed ?? Math.floor(Math.random() * 2 ** 32)),
    [seed],
  );

  const phaseOffsets = useMemo(
    () => Array.from({ length: 8 }, () => random() * Math.PI * 2),
    [random],
  );

  useEffect(() => {
    let frameId = 0;
    let startTime = performance.now();
    let previousTime = startTime;

    const animate = (timestamp: number) => {
      const elapsedSeconds = (timestamp - startTime) / 1000;
      const deltaSeconds = Math.max(0.001, (timestamp - previousTime) / 1000);
      previousTime = timestamp;

      const state = stateRef.current;
      const mode = modeRef.current;

      let targetInput = 0.08;
      let targetOutput = 0.15;

      if (mode === "manual") {
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
        if (state === "talking") {
          targetInput = 0.2;
          targetOutput = clamp01(
            0.66 +
              0.26 *
                Math.sin(elapsedSeconds * 4.3 + phaseOffsets[0]) *
                Math.sin(elapsedSeconds * 1.37 + phaseOffsets[1]),
          );
        } else if (state === "listening") {
          targetInput = clamp01(
            0.44 +
              0.35 *
                Math.sin(elapsedSeconds * 3.1 + phaseOffsets[2]) *
                Math.sin(elapsedSeconds * 1.1 + phaseOffsets[3]),
          );
          targetOutput = 0.22;
        } else if (state === "thinking") {
          targetInput = 0.2 + 0.08 * Math.sin(elapsedSeconds * 1.05 + phaseOffsets[4]);
          targetOutput = 0.28 + 0.1 * Math.sin(elapsedSeconds * 1.25 + phaseOffsets[5]);
        } else {
          targetInput = 0.1 + 0.05 * Math.sin(elapsedSeconds * 0.75 + phaseOffsets[6]);
          targetOutput = 0.14 + 0.06 * Math.sin(elapsedSeconds * 0.9 + phaseOffsets[7]);
        }
      }

      const inputLerp = Math.min(1, deltaSeconds * 9);
      const outputLerp = Math.min(1, deltaSeconds * 8);

      smoothInputRef.current += (targetInput - smoothInputRef.current) * inputLerp;
      smoothOutputRef.current += (targetOutput - smoothOutputRef.current) * outputLerp;

      const inputLevel = smoothInputRef.current;
      const outputLevel = smoothOutputRef.current;
      const dynamics = getStateDynamics(state, inputLevel, outputLevel);

      const energy = clamp01(
        dynamics.baseEnergy + inputLevel * dynamics.inputInfluence + outputLevel * dynamics.outputInfluence,
      );

      const heading =
        Math.sin(elapsedSeconds * dynamics.headingSpeed + phaseOffsets[0]) * 1.2 +
        Math.sin(elapsedSeconds * dynamics.headingJitter + phaseOffsets[1]) * 0.36;

      const baseRadius = 24 + energy * 7 + Math.sin(elapsedSeconds * 0.85 + phaseOffsets[2]) * 0.8;
      const innerRadius = baseRadius * 0.72;

      const outerPath = buildBlobPath({
        baseRadius,
        elapsedSeconds,
        heading,
        energy,
        phases: phaseOffsets,
        directionality: dynamics.directionality,
        speedA: dynamics.speedA,
        speedB: dynamics.speedB,
        wobble: dynamics.wobble,
      });

      const innerPath = buildBlobPath({
        baseRadius: innerRadius,
        elapsedSeconds: elapsedSeconds + 0.18,
        heading: heading * 0.75,
        energy: clamp01(energy * 0.82),
        phases: phaseOffsets,
        directionality: dynamics.directionality * 0.7,
        speedA: dynamics.speedA * 0.85,
        speedB: dynamics.speedB * 0.85,
        wobble: dynamics.wobble * 0.7,
      });

      if (outerBlobRef.current) {
        outerBlobRef.current.setAttribute("d", outerPath);
      }
      if (innerBlobRef.current) {
        innerBlobRef.current.setAttribute("d", innerPath);
      }

      const ringPulse = Math.sin(elapsedSeconds * dynamics.ringPulse + phaseOffsets[3]) * 0.5 + 0.5;
      const ringBaseOpacity =
        state === "talking" ? 0.34 : state === "listening" ? 0.24 : state === "thinking" ? 0.18 : 0.14;

      const ringOneRadius = 31 + energy * 5 + ringPulse * 1.6;
      const ringTwoRadius = 35 + energy * 7 + (1 - ringPulse) * 2.4;

      if (ringOneRef.current) {
        ringOneRef.current.setAttribute("r", ringOneRadius.toFixed(2));
        ringOneRef.current.setAttribute("opacity", (ringBaseOpacity * (0.5 + ringPulse * 0.5)).toFixed(3));
      }

      if (ringTwoRef.current) {
        ringTwoRef.current.setAttribute("r", ringTwoRadius.toFixed(2));
        ringTwoRef.current.setAttribute("opacity", (ringBaseOpacity * (0.3 + (1 - ringPulse) * 0.7)).toFixed(3));
      }

      if (glowRef.current) {
        glowRef.current.setAttribute("r", (33 + energy * 8).toFixed(2));
        glowRef.current.setAttribute("opacity", (0.2 + energy * 0.45).toFixed(3));
      }

      const headingDegrees = heading * (180 / Math.PI);
      const needleScale = 0.94 + energy * 0.14;
      if (needleRef.current) {
        needleRef.current.setAttribute(
          "transform",
          `translate(${CENTER} ${CENTER}) rotate(${headingDegrees.toFixed(2)}) scale(${needleScale.toFixed(3)}) translate(${-CENTER} ${-CENTER})`,
        );
      }

      if (tickGroupRef.current) {
        const tickDrift = Math.sin(elapsedSeconds * 0.24 + phaseOffsets[5]) * 7;
        tickGroupRef.current.setAttribute(
          "transform",
          `rotate(${tickDrift.toFixed(2)} ${CENTER} ${CENTER})`,
        );
      }

      const runtimeColors = colorsRef?.current ?? colorsLiveRef.current;
      const [primary, secondary] = runtimeColors;
      const midTone = mixColor(primary, secondary, 0.58);
      const deepTone = mixColor(primary, STROKE_COLOR, 0.2);

      if (primaryStopRef.current) {
        primaryStopRef.current.setAttribute("stop-color", secondary);
      }
      if (middleStopRef.current) {
        middleStopRef.current.setAttribute("stop-color", midTone);
      }
      if (edgeStopRef.current) {
        edgeStopRef.current.setAttribute("stop-color", deepTone);
      }

      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    colorsRef,
    getInputVolume,
    getOutputVolume,
    inputVolumeRef,
    manualInput,
    manualOutput,
    outputVolumeRef,
    phaseOffsets,
  ]);

  return (
    <div className={className ?? "navi-orb-root"}>
      <svg
        className="navi-orb-svg"
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        role="img"
        aria-label="Navi voice activity"
      >
        <defs>
          <radialGradient id={blobGradientId} cx="50%" cy="44%" r="58%">
            <stop ref={primaryStopRef} offset="0%" stopColor={DEFAULT_COLORS[1]} />
            <stop ref={middleStopRef} offset="58%" stopColor={DEFAULT_COLORS[0]} />
            <stop ref={edgeStopRef} offset="100%" stopColor={DEFAULT_COLORS[0]} />
          </radialGradient>

          <linearGradient id={ringGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1A1A1A" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#1A1A1A" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#1A1A1A" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        <circle
          ref={glowRef}
          className="navi-orb-glow"
          cx={CENTER}
          cy={CENTER}
          r="35"
          fill={`url(#${blobGradientId})`}
          opacity="0.28"
        />

        <circle
          ref={ringTwoRef}
          className="navi-orb-ripple"
          cx={CENTER}
          cy={CENTER}
          r="36"
          stroke={`url(#${ringGradientId})`}
          strokeWidth="1.35"
          fill="none"
          opacity="0.15"
        />

        <circle
          ref={ringOneRef}
          className="navi-orb-ripple"
          cx={CENTER}
          cy={CENTER}
          r="32"
          stroke={`url(#${ringGradientId})`}
          strokeWidth="1.65"
          fill="none"
          opacity="0.22"
        />

        <g ref={tickGroupRef} className="navi-orb-ticks">
          {Array.from({ length: 8 }).map((_, index) => {
            const angle = (index / 8) * Math.PI * 2;
            const inner = 39;
            const outer = index % 2 === 0 ? 45 : 43;
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

        <path
          ref={outerBlobRef}
          d=""
          fill={`url(#${blobGradientId})`}
          stroke={STROKE_COLOR}
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.96"
        />

        <path
          ref={innerBlobRef}
          d=""
          fill="rgba(255, 255, 255, 0.34)"
          stroke="rgba(26, 26, 26, 0.28)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />

        <g ref={needleRef} className="navi-orb-needle">
          <path
            d="M50 22 L56 52 L50 47.4 L44 52 Z"
            fill={STROKE_COLOR}
            opacity="0.92"
          />
          <path
            d="M50 78 L45.7 53 L50 56.2 L54.3 53 Z"
            fill={STROKE_COLOR}
            opacity="0.54"
          />
          <circle cx="50" cy="50" r="3.4" fill={STROKE_COLOR} opacity="0.94" />
          <circle cx="50" cy="50" r="1.3" fill="rgba(255, 255, 255, 0.72)" />
        </g>
      </svg>
    </div>
  );
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

function splitmix32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x9e3779b9) | 0;
    let t = seed ^ (seed >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return (t >>> 0) / 4294967296;
  };
}

type BlobConfig = {
  baseRadius: number;
  elapsedSeconds: number;
  heading: number;
  energy: number;
  phases: number[];
  directionality: number;
  speedA: number;
  speedB: number;
  wobble: number;
};

type Point = {
  x: number;
  y: number;
};

function buildBlobPath(config: BlobConfig): string {
  const {
    baseRadius,
    elapsedSeconds,
    heading,
    energy,
    phases,
    directionality,
    speedA,
    speedB,
    wobble,
  } = config;

  const sampleCount = 20;
  const points: Point[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const angle = (index / sampleCount) * Math.PI * 2;
    const harmonicA = Math.sin(angle * 3 + elapsedSeconds * speedA + phases[0]) * 0.52;
    const harmonicB = Math.sin(angle * 5 - elapsedSeconds * speedB + phases[1]) * 0.34;
    const harmonicC =
      Math.sin(
        angle * 2 +
          Math.sin(elapsedSeconds * 0.88 + phases[2]) * 1.55 +
          elapsedSeconds * 0.34,
      ) * 0.24;

    const directionalPull = Math.cos(angle - heading) * directionality;
    const microWobble = Math.sin(elapsedSeconds * 5.2 + angle * 2.2 + phases[3]) * wobble;

    const localScale =
      1 +
      (harmonicA + harmonicB + harmonicC) * (0.08 + energy * 0.16) +
      directionalPull * (0.05 + energy * 0.11) +
      microWobble * (0.02 + energy * 0.03);

    const radius = Math.max(8, baseRadius * localScale);

    points.push({
      x: CENTER + Math.cos(angle) * radius,
      y: CENTER + Math.sin(angle) * radius,
    });
  }

  return smoothClosedPath(points, 0.24);
}

function smoothClosedPath(points: Point[], tension: number): string {
  if (points.length < 3) return "";

  const pathParts: string[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const nextNext = points[(index + 2) % points.length];

    const control1 = {
      x: current.x + (next.x - previous.x) * tension,
      y: current.y + (next.y - previous.y) * tension,
    };

    const control2 = {
      x: next.x - (nextNext.x - current.x) * tension,
      y: next.y - (nextNext.y - current.y) * tension,
    };

    if (index === 0) {
      pathParts.push(`M ${current.x.toFixed(2)} ${current.y.toFixed(2)}`);
    }

    pathParts.push(
      `C ${control1.x.toFixed(2)} ${control1.y.toFixed(2)} ${control2.x.toFixed(2)} ${control2.y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }

  pathParts.push("Z");
  return pathParts.join(" ");
}

type Dynamics = {
  baseEnergy: number;
  inputInfluence: number;
  outputInfluence: number;
  directionality: number;
  speedA: number;
  speedB: number;
  wobble: number;
  headingSpeed: number;
  headingJitter: number;
  ringPulse: number;
};

function getStateDynamics(
  state: AgentState,
  inputLevel: number,
  outputLevel: number,
): Dynamics {
  if (state === "talking") {
    return {
      baseEnergy: 0.46,
      inputInfluence: 0.32,
      outputInfluence: 0.8,
      directionality: 1.08,
      speedA: 2.3 + outputLevel * 2,
      speedB: 1.5 + outputLevel * 1.6,
      wobble: 0.58,
      headingSpeed: 1.35,
      headingJitter: 2.5,
      ringPulse: 3.25,
    };
  }

  if (state === "listening") {
    return {
      baseEnergy: 0.34,
      inputInfluence: 0.78,
      outputInfluence: 0.3,
      directionality: 0.82,
      speedA: 1.8 + inputLevel * 1.4,
      speedB: 1.15 + inputLevel,
      wobble: 0.44,
      headingSpeed: 1.02,
      headingJitter: 1.95,
      ringPulse: 2.58,
    };
  }

  if (state === "thinking") {
    return {
      baseEnergy: 0.24,
      inputInfluence: 0.4,
      outputInfluence: 0.42,
      directionality: 0.7,
      speedA: 1.05,
      speedB: 0.74,
      wobble: 0.3,
      headingSpeed: 0.72,
      headingJitter: 1.3,
      ringPulse: 1.88,
    };
  }

  return {
    baseEnergy: 0.18,
    inputInfluence: 0.36,
    outputInfluence: 0.36,
    directionality: 0.56,
    speedA: 0.82,
    speedB: 0.58,
    wobble: 0.2,
    headingSpeed: 0.5,
    headingJitter: 0.9,
    ringPulse: 1.48,
  };
}

function mixColor(startColor: string, endColor: string, amount: number): string {
  const normalizedAmount = clamp01(amount);
  const start = parseHexColor(startColor);
  const end = parseHexColor(endColor);

  if (!start || !end) {
    return startColor;
  }

  const red = Math.round(start.r + (end.r - start.r) * normalizedAmount);
  const green = Math.round(start.g + (end.g - start.g) * normalizedAmount);
  const blue = Math.round(start.b + (end.b - start.b) * normalizedAmount);

  return `rgb(${red}, ${green}, ${blue})`;
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }

  return null;
}
