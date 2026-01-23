import { useState, useRef, useCallback } from 'react';

interface RecordingSession {
  sessionId: string;
  isRecording: boolean;
  chunkCount: number;
  error: string | null;
}

interface UseStreamingRecordingOptions {
  chunkDuration?: number; // milliseconds, default 5000
  metadata?: Record<string, unknown>;
  onChunkUploaded?: (chunkIndex: number) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for streaming audio recording with server-side upload
 * Records both user microphone and agent audio, uploads chunks in real-time
 */
export function useStreamingRecording(options: UseStreamingRecordingOptions = {}) {
  const {
    chunkDuration = 5000, // 5 seconds
    metadata = {},
    onChunkUploaded,
    onError,
  } = options;

  const [session, setSession] = useState<RecordingSession>({
    sessionId: '',
    isRecording: false,
    chunkCount: 0,
    error: null,
  });

  // Refs for recording resources
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunkIndexRef = useRef(0);
  const sessionIdRef = useRef<string>('');
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());

  /**
   * Upload a single audio chunk to the server
   */
  const uploadChunk = useCallback(async (sessionId: string, chunkIndex: number, blob: Blob) => {
    try {
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const response = await fetch('/api/recording/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          chunkIndex,
          audioData: base64,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to upload chunk');
      }

      onChunkUploaded?.(chunkIndex);
      setSession(prev => ({ ...prev, chunkCount: chunkIndex + 1 }));
    } catch (error) {
      console.error(`Failed to upload chunk ${chunkIndex}:`, error);
      onError?.(error as Error);
      throw error;
    }
  }, [onChunkUploaded, onError]);

  /**
   * Queue chunk uploads to maintain order
   */
  const queueChunkUpload = useCallback((sessionId: string, chunkIndex: number, blob: Blob) => {
    uploadQueueRef.current = uploadQueueRef.current
      .then(() => uploadChunk(sessionId, chunkIndex, blob))
      .catch(error => {
        console.error('Chunk upload failed:', error);
        // Continue with next chunks even if one fails
      });
  }, [uploadChunk]);

  /**
   * Start recording with the given remote stream (agent audio)
   */
  const startRecording = useCallback(async (remoteStream: MediaStream) => {
    try {
      // Reset state
      chunkIndexRef.current = 0;
      setSession(prev => ({ ...prev, error: null, chunkCount: 0 }));

      // Get microphone stream
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err) {
        console.error('Error getting microphone stream:', err);
        micStream = new MediaStream();
      }
      micStreamRef.current = micStream;

      // Create AudioContext to merge streams
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const destination = audioContext.createMediaStreamDestination();

      // Connect remote stream (agent audio)
      try {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
      } catch (err) {
        console.error('Error connecting remote stream:', err);
      }

      // Connect microphone stream
      try {
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);
      } catch (err) {
        console.error('Error connecting microphone stream:', err);
      }

      // Initialize recording session on server
      const startResponse = await fetch('/api/recording/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata }),
      });

      if (!startResponse.ok) {
        const error = await startResponse.json();
        throw new Error(error.details || 'Failed to start recording session');
      }

      const { sessionId } = await startResponse.json();
      sessionIdRef.current = sessionId;

      // Create MediaRecorder with timeslice for chunked recording
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          const currentChunkIndex = chunkIndexRef.current++;
          queueChunkUpload(sessionId, currentChunkIndex, event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        onError?.(new Error('MediaRecorder error'));
      };

      // Start recording with timeslice for chunked output
      mediaRecorder.start(chunkDuration);
      mediaRecorderRef.current = mediaRecorder;

      setSession({
        sessionId,
        isRecording: true,
        chunkCount: 0,
        error: null,
      });

      console.log(`🎙️ Started streaming recording: ${sessionId}`);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setSession(prev => ({
        ...prev,
        isRecording: false,
        error: (error as Error).message,
      }));
      onError?.(error as Error);
      throw error;
    }
  }, [chunkDuration, metadata, queueChunkUpload, onError]);

  /**
   * Stop recording and finalize the session
   */
  const stopRecording = useCallback(async () => {
    const sessionId = sessionIdRef.current;

    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.requestData(); // Get final chunk
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // Stop microphone tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Wait for pending uploads to complete
    await uploadQueueRef.current;

    // Finalize session on server
    if (sessionId) {
      try {
        const response = await fetch('/api/recording/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          console.error('Failed to end recording session');
        }
      } catch (error) {
        console.error('Error ending recording session:', error);
      }
    }

    setSession(prev => ({
      ...prev,
      isRecording: false,
    }));

    console.log(`🏁 Stopped streaming recording: ${sessionId}`);

    return sessionId;
  }, []);

  return {
    isRecording: session.isRecording,
    sessionId: session.sessionId,
    chunkCount: session.chunkCount,
    error: session.error,
    startRecording,
    stopRecording,
  };
}

export default useStreamingRecording;
