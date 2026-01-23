/**
 * Pelago Design System Background Colors
 * Available colors for UI elements
 */

export interface PelagoColorOption {
  value: string;
  label: string;
  hex: string;
}

export const BACKGROUND_COLORS: PelagoColorOption[] = [
  { value: 'backgroundLight', label: 'Light', hex: '#FFFFFF' },
  { value: 'backgroundLightCard', label: 'Light Card', hex: '#FFFFFF' },
  { value: 'backgroundDark', label: 'Dark', hex: '#121212' },
  { value: 'backgroundTeaGreen', label: 'Tea Green', hex: '#DDF1C4' },
  { value: 'backgroundLightTeaGreen', label: 'Light Tea Green', hex: '#EEF8E2' },
  { value: 'backgroundMintGreen', label: 'Mint Green', hex: '#A2CC6E' },
  { value: 'backgroundLightMintGreen', label: 'Light Mint Green', hex: '#C9E8A3' },
  { value: 'backgroundMossGreen', label: 'Moss Green', hex: '#4D6525' },
  { value: 'backgroundLightMossGreen', label: 'Light Moss Green', hex: '#DBE0D4' },
  { value: 'backgroundPeach', label: 'Peach', hex: '#FCD3BF' },
  { value: 'backgroundLightPeach', label: 'Light Peach', hex: '#FFE9DF' },
  { value: 'backgroundMaroon', label: 'Maroon', hex: '#722F49' },
  { value: 'backgroundLightMaroon', label: 'Light Maroon', hex: '#E4C1CF' },
  { value: 'backgroundTan', label: 'Tan', hex: '#BDA98C' },
  { value: 'backgroundLightTan', label: 'Light Tan', hex: '#DED4C7' },
  { value: 'backgroundPunchPink', label: 'Punch Pink', hex: '#EEBCFF' },
  { value: 'backgroundLightPunchPink', label: 'Light Punch Pink', hex: '#F7DFFE' },
  { value: 'backgroundCerulean', label: 'Cerulean', hex: '#A4BDFF' },
  { value: 'backgroundMistBlue', label: 'Mist Blue', hex: '#E8EEFF' },
  { value: 'backgroundStormBlue', label: 'Storm Blue', hex: '#48536F' },
  { value: 'backgroundStormGray', label: 'Storm Gray', hex: '#E4E6EC' },
  { value: 'backgroundCream', label: 'Cream', hex: '#FFF4DC' },
  { value: 'backgroundYellow', label: 'Yellow', hex: '#FAE355' },
  { value: 'backgroundError', label: 'Error', hex: '#FEF3F2' },
  { value: 'backgroundSuccess', label: 'Success', hex: '#ECFDF3' },
  { value: 'backgroundWarning', label: 'Warning', hex: '#FFF1DE' },
];

export const TEXT_COLORS: PelagoColorOption[] = [
  { value: 'textGlobalPrimary', label: 'Primary', hex: '#212633' },
  { value: 'textGlobalSecondary', label: 'Secondary', hex: '#6F7070' },
  { value: 'textGlobalDisabled', label: 'Disabled', hex: '#E5E6EA' },
  { value: 'textGlobalLight', label: 'Light', hex: '#FFFFFF' },
  { value: 'textSuccess', label: 'Success', hex: '#198639' },
  { value: 'textWarning', label: 'Warning', hex: '#F79009' },
  { value: 'textError', label: 'Error', hex: '#D02F15' },
];

export const ALL_COLORS = [...BACKGROUND_COLORS, ...TEXT_COLORS];

/**
 * Find a color option by its value
 */
export function findColorByValue(value: string): PelagoColorOption | undefined {
  return ALL_COLORS.find(c => c.value === value);
}
