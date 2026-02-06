import { describe, it, expect } from 'vitest';
import { buildElevenLabsOverrides } from './buildElevenLabsOverrides';

describe('buildElevenLabsOverrides', () => {
  it('returns null when no overrides are provided', () => {
    const result = buildElevenLabsOverrides({});
    expect(result).toBeNull();
  });

  it('places prompt override at overrides.agent.prompt.prompt (not nested deeper)', () => {
    const prompt = 'You are Navi, a supportive AI guide within the Pelago program.';
    const result = buildElevenLabsOverrides({ promptOverride: prompt });

    expect(result).not.toBeNull();
    expect(result!.agent).toBeDefined();
    expect(result!.agent!.prompt).toBeDefined();
    expect(result!.agent!.prompt!.prompt).toBe(prompt);
  });

  it('places tts override at overrides.tts (NOT inside overrides.agent)', () => {
    const result = buildElevenLabsOverrides({
      promptOverride: 'test prompt',
      elevenLabsVoiceId: 'voice-123',
    });

    expect(result).not.toBeNull();
    expect(result!.tts).toBeDefined();
    expect(result!.tts!.voiceId).toBe('voice-123');
    expect((result!.agent as any).tts).toBeUndefined();
  });

  it('does NOT include firstMessage override (keeps ElevenLabs dashboard firstMessage)', () => {
    const result = buildElevenLabsOverrides({
      promptOverride: 'test prompt',
      elevenLabsVoiceId: 'voice-123',
    });

    expect(result).not.toBeNull();
    expect((result!.agent as any).firstMessage).toBeUndefined();
  });

  it('produces the exact structure expected by ElevenLabs SDK', () => {
    const prompt = 'System prompt content here';
    const voiceId = 'voice-abc';
    const tools = [{ name: 'end_call', description: 'End the call' }];

    const result = buildElevenLabsOverrides({
      promptOverride: prompt,
      elevenLabsVoiceId: voiceId,
      toolOverrides: tools,
    });

    expect(result).toEqual({
      agent: {
        prompt: {
          prompt: prompt,
          tools: tools,
        },
      },
      tts: {
        voiceId: voiceId,
      },
    });
  });

  it('handles prompt-only override (no voice, no tools)', () => {
    const result = buildElevenLabsOverrides({
      promptOverride: 'only a prompt',
    });

    expect(result).toEqual({
      agent: {
        prompt: {
          prompt: 'only a prompt',
        },
      },
    });
    expect(result!.tts).toBeUndefined();
  });

  it('handles voice-only override (no prompt, no tools)', () => {
    const result = buildElevenLabsOverrides({
      elevenLabsVoiceId: 'voice-only',
    });

    expect(result).toEqual({
      agent: {},
      tts: {
        voiceId: 'voice-only',
      },
    });
  });

  it('handles tool-only override (no prompt, no voice)', () => {
    const tools = [{ name: 'end_call', description: 'End the call' }];
    const result = buildElevenLabsOverrides({
      toolOverrides: tools,
    });

    expect(result).toEqual({
      agent: {
        prompt: {
          tools: tools,
        },
      },
    });
  });

  it('handles large prompt without truncation', () => {
    const largePrompt = 'A'.repeat(50000);
    const result = buildElevenLabsOverrides({ promptOverride: largePrompt });

    expect(result!.agent!.prompt!.prompt).toBe(largePrompt);
    expect(result!.agent!.prompt!.prompt!.length).toBe(50000);
  });

  it('ignores empty tool array', () => {
    const result = buildElevenLabsOverrides({
      promptOverride: 'test',
      toolOverrides: [],
    });

    expect(result!.agent!.prompt!.tools).toBeUndefined();
    expect(result!.agent!.prompt!.prompt).toBe('test');
  });
});
