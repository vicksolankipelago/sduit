import { useCallback, useEffect, useRef, useState } from 'react';

type PreviewRecordingStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'error';

interface StartPreviewRecordingOptions {
  previewElement: HTMLElement;
  agentAudioStream?: MediaStream | null;
  micStream?: MediaStream | null;
}

interface PreviewFlowRecordingState {
  status: PreviewRecordingStatus;
  elapsedMs: number;
  error: string | null;
  recordingUrl: string | null;
  recordingBlob: Blob | null;
}

interface UsePreviewFlowRecordingResult {
  status: PreviewRecordingStatus;
  isRecording: boolean;
  elapsedMs: number;
  error: string | null;
  recordingUrl: string | null;
  startRecording: (options: StartPreviewRecordingOptions) => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  clearRecording: () => void;
  downloadRecording: () => void;
}

const FRAME_RATE = 30;
const UPDATE_INTERVAL_MS = 250;

function supportedVideoMimeType(): string {
  const preferred = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=opus',
    'video/webm',
  ];
  return preferred.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function usePreviewFlowRecording(): UsePreviewFlowRecordingResult {
  const [state, setState] = useState<PreviewFlowRecordingState>({
    status: 'idle',
    elapsedMs: 0,
    error: null,
    recordingUrl: null,
    recordingBlob: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const finalStreamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const fallbackMicStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<number | null>(null);
  const drawRafRef = useRef<number | null>(null);
  const isStoppingRef = useRef(false);
  const recordingUrlRef = useRef<string | null>(null);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedIntervalRef.current !== null) {
      window.clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
    }
  }, []);

  const startElapsedTimer = useCallback(() => {
    stopElapsedTimer();
    elapsedIntervalRef.current = window.setInterval(() => {
      const startedAt = recordingStartedAtRef.current;
      if (!startedAt) return;
      setState((prev) => ({ ...prev, elapsedMs: Date.now() - startedAt }));
    }, UPDATE_INTERVAL_MS);
  }, [stopElapsedTimer]);

  const cleanupResources = useCallback(() => {
    stopElapsedTimer();

    if (drawRafRef.current !== null) {
      window.cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = null;
    }

    const stopTracks = (stream: MediaStream | null) => {
      if (!stream) return;
      stream.getTracks().forEach((track) => track.stop());
    };

    stopTracks(finalStreamRef.current);
    stopTracks(displayStreamRef.current);
    stopTracks(canvasStreamRef.current);
    stopTracks(fallbackMicStreamRef.current);

    finalStreamRef.current = null;
    displayStreamRef.current = null;
    canvasStreamRef.current = null;
    fallbackMicStreamRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    if (captureVideoRef.current) {
      captureVideoRef.current.pause();
      captureVideoRef.current.srcObject = null;
      captureVideoRef.current.remove();
      captureVideoRef.current = null;
    }

    captureCanvasRef.current = null;
  }, [stopElapsedTimer]);

  const clearRecording = useCallback(() => {
    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
      recordingUrlRef.current = null;
    }
    chunksRef.current = [];
    setState((prev) => ({
      ...prev,
      recordingUrl: null,
      recordingBlob: null,
      error: null,
      elapsedMs: 0,
      status: prev.status === 'recording' || prev.status === 'starting' || prev.status === 'stopping'
        ? prev.status
        : 'idle',
    }));
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    if (isStoppingRef.current) {
      return state.recordingBlob;
    }
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      cleanupResources();
      setState((prev) => ({ ...prev, status: prev.error ? 'error' : 'idle' }));
      return state.recordingBlob;
    }

    isStoppingRef.current = true;
    setState((prev) => ({ ...prev, status: 'stopping' }));

    const recorder = mediaRecorderRef.current;
    const stoppedBlob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => {
        const blob = chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
          : null;
        resolve(blob);
      };
      recorder.onerror = () => resolve(null);
      recorder.stop();
    });

    mediaRecorderRef.current = null;
    cleanupResources();
    isStoppingRef.current = false;

    if (stoppedBlob) {
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
      }
      const nextUrl = URL.createObjectURL(stoppedBlob);
      recordingUrlRef.current = nextUrl;
      setState((prev) => ({
        ...prev,
        status: 'idle',
        recordingBlob: stoppedBlob,
        recordingUrl: nextUrl,
        error: null,
      }));
      return stoppedBlob;
    }

    setState((prev) => ({
      ...prev,
      status: 'error',
      error: prev.error || 'Failed to finalize preview recording.',
    }));
    return null;
  }, [cleanupResources, state.recordingBlob]);

  const startRecording = useCallback(async (options: StartPreviewRecordingOptions) => {
    const { previewElement, agentAudioStream, micStream } = options;

    if (state.status === 'recording' || state.status === 'starting' || state.status === 'stopping') {
      throw new Error('Recording is already in progress.');
    }
    if (!previewElement) {
      throw new Error('Preview element is not available.');
    }
    clearRecording();
    setState((prev) => ({ ...prev, status: 'starting', error: null, elapsedMs: 0 }));

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: FRAME_RATE,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        // In browsers where SDK audio is not exposed as srcObject (e.g. ElevenLabs),
        // tab-share audio can provide the agent track for recording.
        audio: true,
      });
      displayStreamRef.current = displayStream;

      const displayTrack = displayStream.getVideoTracks()[0];
      if (!displayTrack) {
        throw new Error('Display capture did not provide a video track.');
      }

      const captureVideo = document.createElement('video');
      captureVideo.muted = true;
      captureVideo.playsInline = true;
      captureVideo.autoplay = true;
      captureVideo.srcObject = displayStream;
      captureVideo.style.position = 'fixed';
      captureVideo.style.width = '1px';
      captureVideo.style.height = '1px';
      captureVideo.style.opacity = '0';
      captureVideo.style.pointerEvents = 'none';
      captureVideo.style.left = '-9999px';
      captureVideo.style.top = '-9999px';
      document.body.appendChild(captureVideo);
      captureVideoRef.current = captureVideo;

      await captureVideo.play();
      await new Promise<void>((resolve) => {
        if (captureVideo.readyState >= 2) {
          resolve();
          return;
        }
        captureVideo.onloadedmetadata = () => resolve();
      });

      const canvas = document.createElement('canvas');
      const targetWidth = Math.max(1, Math.floor(previewElement.clientWidth * 2));
      const targetHeight = Math.max(1, Math.floor(previewElement.clientHeight * 2));
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      captureCanvasRef.current = canvas;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not initialize canvas for preview capture.');
      }

      const drawFrame = () => {
        if (!captureVideoRef.current || !captureCanvasRef.current) return;
        const videoWidth = captureVideoRef.current.videoWidth;
        const videoHeight = captureVideoRef.current.videoHeight;
        if (videoWidth <= 0 || videoHeight <= 0) {
          drawRafRef.current = window.requestAnimationFrame(drawFrame);
          return;
        }

        const rect = previewElement.getBoundingClientRect();
        const scaleX = videoWidth / window.innerWidth;
        const scaleY = videoHeight / window.innerHeight;

        const sourceX = clamp(Math.floor(rect.left * scaleX), 0, Math.max(0, videoWidth - 1));
        const sourceY = clamp(Math.floor(rect.top * scaleY), 0, Math.max(0, videoHeight - 1));
        const sourceWidth = clamp(
          Math.floor(rect.width * scaleX),
          1,
          Math.max(1, videoWidth - sourceX)
        );
        const sourceHeight = clamp(
          Math.floor(rect.height * scaleY),
          1,
          Math.max(1, videoHeight - sourceY)
        );

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          captureVideoRef.current,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );

        drawRafRef.current = window.requestAnimationFrame(drawFrame);
      };
      drawRafRef.current = window.requestAnimationFrame(drawFrame);

      const canvasStream = canvas.captureStream(FRAME_RATE);
      canvasStreamRef.current = canvasStream;

      const context = new AudioContext();
      audioContextRef.current = context;
      const audioDestination = context.createMediaStreamDestination();

      let hasAgentAudio = false;
      const explicitAgentAudioStream =
        agentAudioStream && agentAudioStream.getAudioTracks().length > 0
          ? agentAudioStream
          : null;
      const tabAudioStream = displayStream.getAudioTracks().length > 0
        ? new MediaStream(displayStream.getAudioTracks())
        : null;

      if (explicitAgentAudioStream) {
        const remoteSource = context.createMediaStreamSource(explicitAgentAudioStream);
        remoteSource.connect(audioDestination);
        hasAgentAudio = true;
      } else if (tabAudioStream) {
        const tabSource = context.createMediaStreamSource(tabAudioStream);
        tabSource.connect(audioDestination);
        hasAgentAudio = true;
      }

      let mixedMicStream = micStream ?? null;
      if (!mixedMicStream || mixedMicStream.getAudioTracks().length === 0) {
        mixedMicStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        fallbackMicStreamRef.current = mixedMicStream;
      }
      if (mixedMicStream.getAudioTracks().length > 0) {
        const micSource = context.createMediaStreamSource(mixedMicStream);
        micSource.connect(audioDestination);
      }

      if (!hasAgentAudio) {
        throw new Error('No agent audio source detected. Share this browser tab with audio enabled, then try again.');
      }

      const finalTracks: MediaStreamTrack[] = [];
      const videoTrack = canvasStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Failed to create preview video track.');
      }
      finalTracks.push(videoTrack);
      finalTracks.push(...audioDestination.stream.getAudioTracks());

      const finalStream = new MediaStream(finalTracks);
      finalStreamRef.current = finalStream;

      displayTrack.onended = () => {
        stopRecording().catch(() => undefined);
      };

      chunksRef.current = [];
      const recorder = new MediaRecorder(finalStream, { mimeType: supportedVideoMimeType() });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Preview recording encountered an error.',
        }));
      };
      recorder.start(1000);

      recordingStartedAtRef.current = Date.now();
      startElapsedTimer();
      setState((prev) => ({
        ...prev,
        status: 'recording',
        elapsedMs: 0,
        error: null,
      }));
    } catch (error) {
      cleanupResources();
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: (error as Error).message || 'Failed to start preview recording.',
      }));
      throw error;
    }
  }, [cleanupResources, clearRecording, startElapsedTimer, state.status, stopRecording]);

  const downloadRecording = useCallback(() => {
    if (!state.recordingUrl) return;
    const anchor = document.createElement('a');
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    anchor.href = state.recordingUrl;
    anchor.download = `flow_preview_recording_${now}.webm`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [state.recordingUrl]);

  useEffect(() => {
    return () => {
      stopRecording().catch(() => undefined);
      if (recordingUrlRef.current) {
        URL.revokeObjectURL(recordingUrlRef.current);
        recordingUrlRef.current = null;
      }
    };
  }, [stopRecording]);

  return {
    status: state.status,
    isRecording: state.status === 'recording',
    elapsedMs: state.elapsedMs,
    error: state.error,
    recordingUrl: state.recordingUrl,
    startRecording,
    stopRecording,
    clearRecording,
    downloadRecording,
  };
}

export default usePreviewFlowRecording;
