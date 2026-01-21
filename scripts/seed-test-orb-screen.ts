/**
 * Seed Script: Create Test Screen with Orb Element
 *
 * This script creates a test global screen with the Voice Orb element.
 * Run with: npx tsx scripts/seed-test-orb-screen.ts
 */

import { db } from '../server/db';
import { globalScreens } from '../shared/models/globalScreens';

async function seedTestOrbScreen() {
  const testScreen = {
    id: 'test-orb-screen',
    title: 'Voice Assistant Demo',
    description: 'A test screen showcasing the Voice Orb element',
    tags: ['demo', 'voice', 'orb'],
    sections: [
      {
        id: 'header-section',
        position: 'fixed-top',
        elements: [
          {
            type: 'textBlock',
            state: { id: 'header-text', text: 'Voice Assistant' },
            style: { style: 'heading1', alignment: 'center' },
          },
        ],
      },
      {
        id: 'main-section',
        position: 'body',
        elements: [
          {
            type: 'spacer',
            state: { id: 'spacer-1' },
            style: { height: 40, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'orb',
            state: {
              id: 'voice-orb',
              colors: ['#A2CC6E', '#DDF1C4'],
              agentState: null,
              volumeMode: 'auto',
            },
            style: { size: 'large' },
          },
          {
            type: 'spacer',
            state: { id: 'spacer-2' },
            style: { height: 32, isFlexible: false, direction: 'vertical' },
          },
          {
            type: 'textBlock',
            state: { id: 'status-text', text: 'Tap to start speaking' },
            style: { style: 'body1', alignment: 'center' },
          },
        ],
      },
      {
        id: 'footer-section',
        position: 'fixed-bottom',
        elements: [
          {
            type: 'button',
            state: { id: 'start-button', title: 'Start Conversation', isDisabled: false },
            style: { style: 'primary', size: 'large' },
          },
        ],
      },
    ],
    events: [],
    state: {},
    hidesBackButton: false,
    version: '1.0.0',
  };

  try {
    console.log('Seeding test orb screen...');

    // Check if already exists
    const existing = await db.select().from(globalScreens).where(
      (eb: any) => eb.eq(globalScreens.id, 'test-orb-screen')
    );

    if (existing.length > 0) {
      console.log('Test screen already exists, updating...');
      await db.update(globalScreens)
        .set({
          ...testScreen,
          updatedAt: new Date(),
        })
        .where((eb: any) => eb.eq(globalScreens.id, 'test-orb-screen'));
    } else {
      console.log('Creating new test screen...');
      await db.insert(globalScreens).values({
        ...testScreen,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log('Test orb screen seeded successfully!');
    console.log('Screen ID: test-orb-screen');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed test screen:', error);
    process.exit(1);
  }
}

seedTestOrbScreen();
