export interface OverrideOptions {
  promptOverride?: string;
  elevenLabsVoiceId?: string;
}

export interface ElevenLabsOverrides {
  agent?: {
    prompt?: {
      prompt?: string;
    };
  };
  tts?: {
    voiceId: string;
  };
}

export function buildElevenLabsOverrides(options: OverrideOptions): ElevenLabsOverrides | null {
  const hasPromptOverride = !!options.promptOverride;
  const hasVoiceOverride = !!options.elevenLabsVoiceId;

  if (!hasPromptOverride && !hasVoiceOverride) {
    return null;
  }

  const overrides: ElevenLabsOverrides = {};
  const agentOverrides: NonNullable<ElevenLabsOverrides['agent']> = {};

  if (hasPromptOverride) {
    agentOverrides.prompt = { prompt: options.promptOverride };
  }

  overrides.agent = agentOverrides;

  if (hasVoiceOverride) {
    overrides.tts = { voiceId: options.elevenLabsVoiceId! };
  }

  return overrides;
}
