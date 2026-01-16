/**
 * Available Lottie Animations
 * 
 * List of all Lottie animation files available in public/animations/
 */

export const AVAILABLE_ANIMATIONS = [
  // Color Pelago Animations
  'COLOR_Pelago_Boat',
  'COLOR_Pelago_Island',
  'COLOR_Pelago_WalkWithPhone',
  'COLOR_Pelago_2WomenWalk',
  'COLOR_Pelago_Board',
  'COLOR_Pelago_IceCream',
  'COLOR_Pelago_Man_On_Bench',
  'COLOR_Pelago_PiggyBank_Option1',
  'COLOR_Pelago_PiggyBank_Option2',
  'COLOR_Pelago_Puzzle_Option1',
  'COLOR_Pelago_Puzzle_Option2',
  'COLOR_Pelago_Puzzle_Option3',
  'COLOR_Pelago_Queue',
  'COLOR_Pelago_RunWithFlag',
  'COLOR_Pelago_SleepUnderTree',
  'COLOR_Pelago_WorkingOnLaptop',
  
  // Success Animations
  'COLOR_Success_Animation',
  'B&W_Success_Animation',
  
  // B&W Pelago Animations
  'B&W_Pelago_Boat',
  'B&W_Pelago_Island',
  'B&W_Pelago_WalkWithPhone',
  'B&W_Pelago_2WomenWalk',
  'B&W_Pelago_Board',
  'B&W_Pelago_SleepUnderTree',
  'B&W_Pelago_Puzzle_Option1',
  
  // Other Animations
  'pelatokensAnimation',
  'SBSanimation',
  'CompletionCoin',
] as const;

export type AnimationName = typeof AVAILABLE_ANIMATIONS[number];

/**
 * Get list of animations grouped by category
 */
export function getAnimationsByCategory() {
  return {
    'Pelago - Color': AVAILABLE_ANIMATIONS.filter(a => a.startsWith('COLOR_Pelago_')),
    'Pelago - B&W': AVAILABLE_ANIMATIONS.filter(a => a.startsWith('B&W_Pelago_')),
    'Success': AVAILABLE_ANIMATIONS.filter(a => a.includes('Success')),
    'Other': AVAILABLE_ANIMATIONS.filter(a => !a.startsWith('COLOR_Pelago_') && !a.startsWith('B&W_Pelago_') && !a.includes('Success')),
  };
}

