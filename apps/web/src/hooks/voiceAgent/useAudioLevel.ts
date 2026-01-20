import { useEffect, useRef, useState } from 'react';

/**
 * Hook to track audio level from a media stream
 * Returns a value between 0 and 1 representing the current audio level
 */
export function useAudioLevel(stream: MediaStream | null): number {
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(undefined);

  useEffect(() => {
    if (!stream) {
      setAudioLevel(0);
      return;
    }

    let analyser: AnalyserNode;
    
    // Avoid creating duplicate audio contexts
    try {
      // Create audio context and analyser
      const audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.85; // More smoothing to reduce crackling

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
    } catch (error) {
      console.error('Failed to create audio analyser:', error);
      return;
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateAudioLevel = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average volume
      const sum = dataArray.reduce((acc, val) => acc + val, 0);
      const average = sum / dataArray.length;

      // Normalize to 0-1 range (0-255 -> 0-1)
      const normalized = average / 255;

      // Apply some scaling to make it more sensitive to speech
      // Boost lower volumes and cap higher ones
      const scaled = Math.min(normalized * 2.5, 1);

      setAudioLevel(scaled);

      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream]);

  return audioLevel;
}

