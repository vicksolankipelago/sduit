export interface OverrideOptions {
  promptOverride?: string;
  elevenLabsVoiceId?: string;
  toolOverrides?: Array<{ name: string; [key: string]: any }>;
}

export interface ElevenLabsOverrides {
  agent?: {
    prompt?: {
      prompt?: string;
      tools?: Array<{ name: string; [key: string]: any }>;
    };
  };
  tts?: {
    voiceId: string;
  };
}

export function buildElevenLabsOverrides(options: OverrideOptions): ElevenLabsOverrides | null {
  const hasPromptOverride = !!options.promptOverride;
  const hasVoiceOverride = !!options.elevenLabsVoiceId;
  const hasToolOverrides = !!options.toolOverrides && options.toolOverrides.length > 0;

  if (!hasPromptOverride && !hasVoiceOverride && !hasToolOverrides) {
    return null;
  }

  const overrides: ElevenLabsOverrides = {};
  const agentOverrides: NonNullable<ElevenLabsOverrides['agent']> = {};

  if (hasPromptOverride || hasToolOverrides) {
    const promptOverride: NonNullable<typeof agentOverrides.prompt> = {};

    if (hasPromptOverride) {
      promptOverride.prompt = options.promptOverride;
    }

    if (hasToolOverrides) {
      promptOverride.tools = options.toolOverrides;
    }

    agentOverrides.prompt = promptOverride;
  }

  overrides.agent = agentOverrides;

  if (hasVoiceOverride) {
    overrides.tts = { voiceId: options.elevenLabsVoiceId! };
  }

  return overrides;
}
