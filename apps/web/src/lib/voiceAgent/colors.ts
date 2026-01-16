/**
 * Pelago Design System Colours
 * Based on Aurora Design System
 */

// Primary Colours
export const primaryColours = {
  default: '#212633',
  hover: '#373C47',
  pressed: '#000000',
  disabled: '#909399',
} as const;

// Secondary Colours
export const secondaryColours = {
  default: '#FAE355',
  hover: '#FCEA8E',
  pressed: '#E0CB58',
  disabled: '#FEF7CE',
} as const;

// Alert Colours
export const alertColours = {
  success: {
    default: '#198639',
    hover: '#22B04C',
    pressed: '#14662C',
    disabled: '#EDFFF2',
  },
  warning: {
    default: '#F79009',
    hover: '#FEC84B',
    pressed: '#B54708',
    disabled: '#FEF0C7',
  },
  error: {
    default: '#F04438',
    hover: '#FDA29B',
    pressed: '#B42318',
    disabled: '#FEF3F2',
  },
} as const;

// Background Colours
export const backgroundColours = {
  light: '#FFFFFF',
  dark: '#121212',
  lightCard: '#FFFFFF',
  mistBlue: '#E8EEFF',
  cerulean: '#A4BDFF',
  lightPeach: '#FFE9DF',
  peach: '#FCD3BF',
  lightPunchPink: '#F7DFFE',
  punchPink: '#EEBCFF',
  lightMaroon: '#E4C1CF',
  maroon: '#722F49',
  lightTeaGreen: '#EEF8E2',
  teaGreen: '#DDF1C4',
  cream: '#FFF4DC',
  yellow: '#FAE355',
  lightMossGreen: '#DBE0D4',
  mossGreen: '#4D6525',
  lightMintGreen: '#C9E8A3',
  mintGreen: '#A2CC6E',
  lightTan: '#DED4C7',
  tan: '#BDA98C',
  stormGray: '#E4E6EC',
  stormBlue: '#48536F',
  containerHover: '#F2F2F2',
  actionHover: '#F2F2F2',
  error: '#FEF3F2',
  warning: '#FFF1DE',
  success: '#ECFDF3',
} as const;

// Text Colours
export const textColours = {
  globalPrimary: '#212633',
  globalSecondary: '#6F7070',
  globalDisabled: '#E5E6EA',
  globalLight: '#FFFFFF',
  primaryButton: '#FFFFFF',
  secondaryButton: '#212633',
  alertButton: '#FFFFFF',
  primaryInform: '#212633',
  linkPrimaryDefault: '#373C47',
  linkPrimaryHover: '#000000',
  linkPrimaryPressed: '#909399',
  success: '#198639',
  warning: '#F79009',
  error: '#D02F15',
} as const;

// UI Element Colours
export const uiElementColours = {
  divider: '#CCCCCC',
  outlineDefault: '#CCCCCC',
  outlineActive: '#212633',
  outlineDisabled: '#CCCCCC',
  outlineError: '#F04438',
  outlineSuccess: '#32D583',
  outlineWarning: '#F79009',
} as const;

// Combined colour palette
export const pelagoColours = {
  primary: primaryColours,
  secondary: secondaryColours,
  alert: alertColours,
  background: backgroundColours,
  text: textColours,
  uiElement: uiElementColours,
} as const;
