/**
 * Audio Routing for Voice-to-Voice Persona
 * 
 * Routes audio bidirectionally between agent and persona
 */

export class VoiceAgentAudioRouter {
  private audioContext: AudioContext | null = null;
  private agentSourceNode: MediaStreamAudioSourceNode | null = null;
  private personaSourceNode: MediaStreamAudioSourceNode | null = null;
  private personaInputDestination: MediaStreamAudioDestinationNode | null = null;
  private agentInputDestination: MediaStreamAudioDestinationNode | null = null;

  /**
   * Set up bidirectional audio routing
   * Agent output → Persona input
   * Persona output → Agent input
   */
  async setupBidirectionalRouting(
    agentAudioElement: HTMLAudioElement,
    personaAudioElement: HTMLAudioElement
  ): Promise<{ personaMicStream: MediaStream; agentMicStream: MediaStream }> {
    console.log('🔊 Setting up bidirectional audio routing');
    
    // Create audio context
    this.audioContext = new AudioContext();
    
    // Create destinations immediately
    this.personaInputDestination = this.audioContext.createMediaStreamDestination();
    this.agentInputDestination = this.audioContext.createMediaStreamDestination();

    // Set up Agent → Persona routing
    const setupAgentToPersona = (): Promise<void> => {
      return new Promise((resolve) => {
        const checkAudio = () => {
          if (!agentAudioElement.srcObject) {
            setTimeout(checkAudio, 100);
            return;
          }

          const agentStream = agentAudioElement.srcObject as MediaStream;
          this.agentSourceNode = this.audioContext!.createMediaStreamSource(agentStream);
          this.agentSourceNode.connect(this.personaInputDestination!);
          
          console.log('✅ Agent → Persona routing established');
          resolve();
        };
        checkAudio();
      });
    };

    // Set up Persona → Agent routing
    const setupPersonaToAgent = (): Promise<void> => {
      return new Promise((resolve) => {
        const checkAudio = () => {
          if (!personaAudioElement.srcObject) {
            setTimeout(checkAudio, 100);
            return;
          }

          const personaStream = personaAudioElement.srcObject as MediaStream;
          this.personaSourceNode = this.audioContext!.createMediaStreamSource(personaStream);
          this.personaSourceNode.connect(this.agentInputDestination!);
          
          console.log('✅ Persona → Agent routing established');
          resolve();
        };
        checkAudio();
      });
    };

    // Start both routings in background
    setupAgentToPersona();
    setupPersonaToAgent();

    // Return both streams immediately
    return {
      personaMicStream: this.personaInputDestination.stream,
      agentMicStream: this.agentInputDestination.stream
    };
  }

  /**
   * Clean up audio routing
   */
  cleanup() {
    if (this.agentSourceNode) {
      this.agentSourceNode.disconnect();
      this.agentSourceNode = null;
    }

    if (this.personaSourceNode) {
      this.personaSourceNode.disconnect();
      this.personaSourceNode = null;
    }

    if (this.personaInputDestination) {
      this.personaInputDestination = null;
    }

    if (this.agentInputDestination) {
      this.agentInputDestination = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('✅ Audio routing cleaned up');
  }
}

