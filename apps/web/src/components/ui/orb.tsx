import React, { useEffect, useMemo, useRef } from "react";
import "./orb.css";

export type AgentState = null | "thinking" | "listening" | "talking";

type OrbProps = {
  colors?: [string, string];
  iconImage?: string;
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

const DEFAULT_COLORS: [string, string] = ["#222838", "#303B52"];

export function Orb({
  colors = DEFAULT_COLORS,
  iconImage,
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
  void colorsRef;
  void resizeDebounce;
  void seed;

  const iconRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInputRef = useRef(clamp01(manualInput ?? 0));
  const manualOutputRef = useRef(clamp01(manualOutput ?? 0));
  const smoothInputRef = useRef(0);
  const smoothOutputRef = useRef(0);
  const smoothScaleRef = useRef(1);
  const rotationDegreesRef = useRef(0);
  const rotationSpeedRef = useRef(0);
  const [iconLoadFailed, setIconLoadFailed] = React.useState(false);

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
    setIconLoadFailed(false);
  }, [iconImage]);

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

      const signalSmoothing = Math.min(1, deltaSeconds * 9);
      smoothInputRef.current += (targetInput - smoothInputRef.current) * signalSmoothing;
      smoothOutputRef.current += (targetOutput - smoothOutputRef.current) * signalSmoothing;

      const targetScale = getTargetScale(
        state,
        elapsed,
        smoothInputRef.current,
        smoothOutputRef.current,
      );

      const scaleSmoothing = Math.min(1, deltaSeconds * 12);
      smoothScaleRef.current += (targetScale - smoothScaleRef.current) * scaleSmoothing;

      const audioEnergy = clamp01(
        state === "talking"
          ? smoothOutputRef.current
          : state === "listening"
            ? smoothInputRef.current
            : Math.max(smoothInputRef.current, smoothOutputRef.current),
      );
      const targetRotationSpeed = getTargetRotationSpeed(state, audioEnergy);
      const rotationSmoothing = Math.min(1, deltaSeconds * 10);
      rotationSpeedRef.current +=
        (targetRotationSpeed - rotationSpeedRef.current) * rotationSmoothing;
      rotationDegreesRef.current =
        (rotationDegreesRef.current + rotationSpeedRef.current * deltaSeconds) % 360;

      const wobbleAmplitude =
        state === "talking" ? 1.8 + audioEnergy * 3.2 : state === "listening" ? 1 + audioEnergy * 2.1 : 0.5;
      const wobble = Math.sin(elapsed * (3.2 + audioEnergy * 5.8)) * wobbleAmplitude;
      const renderedRotation = rotationDegreesRef.current + wobble;

      if (iconRef.current) {
        const scale = smoothScaleRef.current;
        const glowStrength = clamp01(
          state === "talking" ? smoothOutputRef.current : smoothInputRef.current * 0.6,
        );

        iconRef.current.style.transform = `scale(${scale.toFixed(3)}) rotate(${renderedRotation.toFixed(2)}deg)`;
        iconRef.current.style.setProperty(
          "--navi-icon-glow-opacity",
          (0.16 + glowStrength * 0.34).toFixed(3),
        );
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

  const rootStyle: React.CSSProperties & Record<
    "--navi-icon-color" | "--navi-icon-accent",
    string
  > = useMemo(
    () => ({
      "--navi-icon-color": colors[0] || DEFAULT_COLORS[0],
      "--navi-icon-accent": colors[1] || DEFAULT_COLORS[1],
    }),
    [colors],
  );

  const resolvedIconSrc = useMemo(() => {
    if (!iconImage) return null;

    const trimmed = iconImage.trim();
    if (!trimmed) return null;

    // Keep explicit URLs/paths untouched.
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("data:")
    ) {
      return trimmed;
    }

    // If extension is present, assume assets live under /images.
    if (/\.(svg|png|jpg|jpeg|webp)$/i.test(trimmed)) {
      return `/images/${trimmed}`;
    }

    // Match existing image conventions used by SDUI image elements.
    if (trimmed.startsWith("Colour") || trimmed.startsWith("Mono")) {
      return `/illustrations/${trimmed}.svg`;
    }

    return `/images/${trimmed}.png`;
  }, [iconImage]);

  return (
    <div className={className ? `${className} navi-orb-root` : "navi-orb-root"} style={rootStyle}>
      <div className="navi-icon-wrapper" ref={iconRef}>
        {iconImage ? (
          <img
            className="navi-icon-image"
            src={resolvedIconSrc ?? iconImage}
            alt="Orb icon"
            draggable={false}
            onError={() => setIconLoadFailed(true)}
          />
        ) : null}
        {!iconImage || iconLoadFailed ? (
          <svg
            className="navi-icon-svg"
            viewBox="0 0 100 100"
            role="img"
            aria-label="Compass icon"
          >
            <circle className="navi-icon-ring-outer" cx="50" cy="50" r="34" />
            <circle className="navi-icon-ring-inner" cx="50" cy="50" r="22" />
            <path className="navi-icon-needle" d="M63 37 55.5 55.5 37 63 44.5 44.5Z" />
            <circle className="navi-icon-core" cx="50" cy="50" r="3.2" />
          </svg>
        ) : null}
      </div>
    </div>
  );
}

function readVolume(
  directValue: number | undefined,
  fallbackRef: React.RefObject<number> | { current: number },
  externalRef?: React.RefObject<number>,
  externalReader?: () => number,
) {
  if (typeof directValue === "number") return clamp01(directValue);
  if (externalRef && typeof externalRef.current === "number") return clamp01(externalRef.current);
  if (externalReader) return clamp01(externalReader());
  return clamp01(fallbackRef.current);
}

function getAutoLevels(state: AgentState, elapsed: number) {
  switch (state) {
    case "talking":
      return {
        input: 0,
        output: 0.4 + (Math.sin(elapsed * 6) * 0.5 + 0.5) * 0.45,
      };
    case "listening":
      return {
        input: 0.2 + (Math.sin(elapsed * 4.2) * 0.5 + 0.5) * 0.28,
        output: 0,
      };
    case "thinking":
      return {
        input: 0,
        output: 0.12 + (Math.sin(elapsed * 2.6) * 0.5 + 0.5) * 0.14,
      };
    default:
      return { input: 0, output: 0 };
  }
}

function getTargetScale(
  state: AgentState,
  elapsed: number,
  inputLevel: number,
  outputLevel: number,
) {
  if (state === "talking") {
    const energy = clamp01(outputLevel);
    const rhythmicLift = Math.sin(elapsed * 3.8) * 0.025 * (0.4 + energy * 0.6);
    return 0.88 + energy * 0.34 + rhythmicLift;
  }

  if (state === "listening") {
    return 0.96 + clamp01(inputLevel) * 0.12;
  }

  if (state === "thinking") {
    return 0.99 + Math.sin(elapsed * 2.2) * 0.02;
  }

  // Subtle idle breathing so scale animation still exists even without active speech/listening.
  return 0.99 + Math.sin(elapsed * 2.1) * 0.015;
}

function getTargetRotationSpeed(state: AgentState, energy: number) {
  switch (state) {
    case "talking":
      return 18 + energy * 165;
    case "listening":
      return 6 + energy * 52;
    case "thinking":
      return 14;
    default:
      // Keep a gentle idle rotation.
      return 7;
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(value, 1));
}
