import React, { useEffect, useRef } from 'react';
import './VoiceAgentOrb.css';

export interface VoiceAgentOrbProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  audioLevel?: number; // 0-1 range for audio reactivity
}

export const VoiceAgentOrb: React.FC<VoiceAgentOrbProps> = ({
  isActive,
  isSpeaking,
  isListening,
  audioLevel = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(undefined);
  const timeRef = useRef(0);
  const smoothedAudioLevel = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 300;
    
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = 80;

    const animate = () => {
      timeRef.current += 0.016; // ~60fps
      
      // Smooth audio level changes for less jittery animation
      smoothedAudioLevel.current += (audioLevel - smoothedAudioLevel.current) * 0.3;
      
      ctx.clearRect(0, 0, size, size);

      // Create gradient
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 1.5);
      
      // Convert hex #F7DFFE to RGB: 247, 223, 254
      const lavenderLight = 'rgba(247, 223, 254, 0.9)';
      const lavenderMid = 'rgba(247, 223, 254, 0.6)';
      const lavenderFade = 'rgba(247, 223, 254, 0)';
      
      if (isSpeaking) {
        // Speaking: lavender with pulsing
        gradient.addColorStop(0, lavenderLight);
        gradient.addColorStop(0.5, lavenderMid);
        gradient.addColorStop(1, lavenderFade);
      } else if (isActive) {
        // Active but idle: subtle lavender
        gradient.addColorStop(0, 'rgba(247, 223, 254, 0.5)');
        gradient.addColorStop(0.5, 'rgba(247, 223, 254, 0.3)');
        gradient.addColorStop(1, lavenderFade);
      } else {
        // Inactive: gray
        gradient.addColorStop(0, 'rgba(107, 107, 107, 0.4)');
        gradient.addColorStop(0.5, 'rgba(155, 155, 155, 0.2)');
        gradient.addColorStop(1, 'rgba(107, 107, 107, 0)');
      }

      // Draw multiple concentric circles with animation
      const numWaves = 5;
      for (let i = 0; i < numWaves; i++) {
        // Slower animation: changed from * 2 to * 0.6 for more subtle movement
        const offset = (timeRef.current * 0.6 + i * 0.8) % 4;
        
        // Audio-reactive scaling for listening/speaking states
        let scale = 1;
        if (isSpeaking) {
          scale = 1 + Math.sin(timeRef.current * 3 + i) * 0.15;
        } else if (isListening) {
          // React to audio input when listening
          const audioBoost = smoothedAudioLevel.current * 0.2;
          scale = 1 + audioBoost;
        }
        
        const radius = baseRadius + offset * 20;
        const opacity = Math.max(0, 1 - offset / 4);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * scale, 0, Math.PI * 2);
        
        // Use lavender color for ripples only when speaking, otherwise gray
        if (isSpeaking) {
          ctx.strokeStyle = `rgba(247, 223, 254, ${opacity * 0.4})`;
        } else {
          ctx.strokeStyle = `rgba(200, 200, 200, ${opacity * 0.2})`;
        }
        
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw main orb with audio-reactive pulsing
      let pulseScale = 1;
      if (isSpeaking) {
        pulseScale = 1 + Math.sin(timeRef.current * 4) * 0.1;
      } else if (isListening) {
        // Slower base pulse + audio reactivity
        const basePulse = Math.sin(timeRef.current * 1.2) * 0.03; // Reduced from * 2 to * 1.2
        const audioReactivity = smoothedAudioLevel.current * 0.15; // React to audio level
        pulseScale = 1 + basePulse + audioReactivity;
      }

      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Inner glow
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * pulseScale * 0.7, 0, Math.PI * 2);
      const innerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.7);
      innerGradient.addColorStop(0, isSpeaking ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)');
      innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = innerGradient;
      ctx.fill();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isSpeaking, isListening, audioLevel]);

  return (
    <div className={`voice-agent-orb-container ${isActive ? 'active' : ''} ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}>
      <canvas ref={canvasRef} className="voice-agent-orb-canvas" />
      <div className="voice-agent-orb-state-label">
        {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : isActive ? 'Ready' : 'Inactive'}
      </div>
    </div>
  );
};

export default VoiceAgentOrb;

