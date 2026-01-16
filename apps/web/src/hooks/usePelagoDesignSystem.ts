/**
 * Pelago Design System Hook
 * 
 * Utility hook for accessing Pelago design system values in React components
 */

export interface PelagoColors {
  // Text colors
  textGlobalPrimary: string;
  textGlobalSecondary: string;
  textGlobalTertiary: string;
  textGlobalDisabled: string;
  textGlobalLight: string;
  textButtonPrimary: string;
  textButtonSecondary: string;
  textButtonAlert: string;
  textError: string;
  textSuccess: string;
  textWarning: string;
  
  // Background colors
  backgroundLight: string;
  backgroundLightCard: string;
  backgroundDark: string;
  backgroundTeaGreen: string;
  backgroundLightTeaGreen: string;
  backgroundMintGreen: string;
  backgroundLightMintGreen: string;
  backgroundMossGreen: string;
  backgroundLightMossGreen: string;
  backgroundPeach: string;
  backgroundLightPeach: string;
  backgroundMaroon: string;
  backgroundLightMaroon: string;
  backgroundTan: string;
  backgroundLightTan: string;
  backgroundPunchPink: string;
  backgroundLightPunchPink: string;
  backgroundCerulean: string;
  backgroundMistBlue: string;
  backgroundStormBlue: string;
  backgroundStormGray: string;
  backgroundCream: string;
  backgroundYellow: string;
  backgroundError: string;
  backgroundSuccess: string;
  backgroundWarning: string;
  
  // CTA colors
  primaryCTADefault: string;
  primaryCTAHover: string;
  primaryCTAPressed: string;
  primaryCTADisabled: string;
  
  // Secondary colors
  secondaryDefault: string;
  secondaryHover: string;
  secondaryPressed: string;
  secondaryDisabled: string;
  
  // Alert colors
  alertErrorDefault: string;
  alertErrorHover: string;
  alertErrorPressed: string;
  alertErrorDisabled: string;
  alertSuccessDefault: string;
  alertSuccessHover: string;
  alertSuccessPressed: string;
  alertSuccessDisabled: string;
  alertWarningDefault: string;
  alertWarningHover: string;
  alertWarningPressed: string;
  alertWarningDisabled: string;
  
  // UI element colors
  uiElementDivider: string;
  uiElementOutlineDefault: string;
  uiElementOutlineActive: string;
  uiElementOutlineDisabled: string;
  uiElementOutlineError: string;
  uiElementOutlineSuccess: string;
  uiElementOutlineWarning: string;
}

export interface PelagoFonts {
  display: string;
  header1: string;
  header2: string;
  header3: string;
  body1Bold: string;
  body1Medium: string;
  body1Regular: string;
  body1Serif: string;
  body2Bold: string;
  body2Medium: string;
  body2Regular: string;
  body2Serif: string;
  body3Regular: string;
  caption1Bold: string;
  caption2Bold: string;
  caption2Regular: string;
  button1Bold: string;
  button2Bold: string;
}

export interface PelagoSpacing {
  unit: number;
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xl2: number;
  paddingHorizontalStandard: number;
}

export interface PelagoBorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface PelagoDesignSystem {
  colors: PelagoColors;
  fonts: PelagoFonts;
  spacing: PelagoSpacing;
  borderRadius: PelagoBorderRadius;
  getCSSVar: (varName: string) => string;
}

/**
 * Get CSS variable value from the design system
 */
function getCSSVar(varName: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/**
 * Hook to access Pelago design system values
 */
export function usePelagoDesignSystem(): PelagoDesignSystem {
  const colors: PelagoColors = {
    // Text colors
    textGlobalPrimary: getCSSVar('--text-global-primary'),
    textGlobalSecondary: getCSSVar('--text-global-secondary'),
    textGlobalTertiary: getCSSVar('--text-global-tertiary'),
    textGlobalDisabled: getCSSVar('--text-global-disabled'),
    textGlobalLight: getCSSVar('--text-global-light'),
    textButtonPrimary: getCSSVar('--text-button-primary'),
    textButtonSecondary: getCSSVar('--text-button-secondary'),
    textButtonAlert: getCSSVar('--text-button-alert'),
    textError: getCSSVar('--text-error'),
    textSuccess: getCSSVar('--text-success'),
    textWarning: getCSSVar('--text-warning'),
    
    // Background colors
    backgroundLight: getCSSVar('--background-light'),
    backgroundLightCard: getCSSVar('--background-light-card'),
    backgroundDark: getCSSVar('--background-dark'),
    backgroundTeaGreen: getCSSVar('--background-tea-green'),
    backgroundLightTeaGreen: getCSSVar('--background-light-tea-green'),
    backgroundMintGreen: getCSSVar('--background-mint-green'),
    backgroundLightMintGreen: getCSSVar('--background-light-mint-green'),
    backgroundMossGreen: getCSSVar('--background-moss-green'),
    backgroundLightMossGreen: getCSSVar('--background-light-moss-green'),
    backgroundPeach: getCSSVar('--background-peach'),
    backgroundLightPeach: getCSSVar('--background-light-peach'),
    backgroundMaroon: getCSSVar('--background-maroon'),
    backgroundLightMaroon: getCSSVar('--background-light-maroon'),
    backgroundTan: getCSSVar('--background-tan'),
    backgroundLightTan: getCSSVar('--background-light-tan'),
    backgroundPunchPink: getCSSVar('--background-punch-pink'),
    backgroundLightPunchPink: getCSSVar('--background-light-punch-pink'),
    backgroundCerulean: getCSSVar('--background-cerulean'),
    backgroundMistBlue: getCSSVar('--background-mist-blue'),
    backgroundStormBlue: getCSSVar('--background-storm-blue'),
    backgroundStormGray: getCSSVar('--background-storm-gray'),
    backgroundCream: getCSSVar('--background-cream'),
    backgroundYellow: getCSSVar('--background-yellow'),
    backgroundError: getCSSVar('--background-error'),
    backgroundSuccess: getCSSVar('--background-success'),
    backgroundWarning: getCSSVar('--background-warning'),
    
    // CTA colors
    primaryCTADefault: getCSSVar('--primary-cta-default'),
    primaryCTAHover: getCSSVar('--primary-cta-hover'),
    primaryCTAPressed: getCSSVar('--primary-cta-pressed'),
    primaryCTADisabled: getCSSVar('--primary-cta-disabled'),
    
    // Secondary colors
    secondaryDefault: getCSSVar('--secondary-default'),
    secondaryHover: getCSSVar('--secondary-hover'),
    secondaryPressed: getCSSVar('--secondary-pressed'),
    secondaryDisabled: getCSSVar('--secondary-disabled'),
    
    // Alert colors
    alertErrorDefault: getCSSVar('--alert-error-default'),
    alertErrorHover: getCSSVar('--alert-error-hover'),
    alertErrorPressed: getCSSVar('--alert-error-pressed'),
    alertErrorDisabled: getCSSVar('--alert-error-disabled'),
    alertSuccessDefault: getCSSVar('--alert-success-default'),
    alertSuccessHover: getCSSVar('--alert-success-hover'),
    alertSuccessPressed: getCSSVar('--alert-success-pressed'),
    alertSuccessDisabled: getCSSVar('--alert-success-disabled'),
    alertWarningDefault: getCSSVar('--alert-warning-default'),
    alertWarningHover: getCSSVar('--alert-warning-hover'),
    alertWarningPressed: getCSSVar('--alert-warning-pressed'),
    alertWarningDisabled: getCSSVar('--alert-warning-disabled'),
    
    // UI element colors
    uiElementDivider: getCSSVar('--ui-element-divider'),
    uiElementOutlineDefault: getCSSVar('--ui-element-outline-default'),
    uiElementOutlineActive: getCSSVar('--ui-element-outline-active'),
    uiElementOutlineDisabled: getCSSVar('--ui-element-outline-disabled'),
    uiElementOutlineError: getCSSVar('--ui-element-outline-error'),
    uiElementOutlineSuccess: getCSSVar('--ui-element-outline-success'),
    uiElementOutlineWarning: getCSSVar('--ui-element-outline-warning'),
  };

  const fonts: PelagoFonts = {
    display: 'pelago-display',
    header1: 'pelago-header-1',
    header2: 'pelago-header-2',
    header3: 'pelago-header-3',
    body1Bold: 'pelago-body-1-bold',
    body1Medium: 'pelago-body-1-medium',
    body1Regular: 'pelago-body-1-regular',
    body1Serif: 'pelago-body-1-serif',
    body2Bold: 'pelago-body-2-bold',
    body2Medium: 'pelago-body-2-medium',
    body2Regular: 'pelago-body-2-regular',
    body2Serif: 'pelago-body-2-serif',
    body3Regular: 'pelago-body-3-regular',
    caption1Bold: 'pelago-caption-1-bold',
    caption2Bold: 'pelago-caption-2-bold',
    caption2Regular: 'pelago-caption-2-regular',
    button1Bold: 'pelago-button-1-bold',
    button2Bold: 'pelago-button-2-bold',
  };

  const spacing: PelagoSpacing = {
    unit: 4,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xl2: 48,
    paddingHorizontalStandard: 24,
  };

  const borderRadius: PelagoBorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  };

  return {
    colors,
    fonts,
    spacing,
    borderRadius,
    getCSSVar,
  };
}

/**
 * Map iOS color names to CSS variable names
 */
export function mapIOSColorToCSSVar(iosColorName: string): string {
  const colorMap: Record<string, string> = {
    // Direct mappings
    'textGlobalPrimary': '--text-global-primary',
    'textGlobalSecondary': '--text-global-secondary',
    'textGlobalDisabled': '--text-global-disabled',
    'backgroundTeaGreen': '--background-tea-green',
    'backgroundLightTeaGreen': '--background-light-tea-green',
    'backgroundLight': '--background-light',
    'backgroundLightCard': '--background-light-card',
    'backgroundMistBlue': '--background-mist-blue',
    'backgroundMintGreen': '--background-mint-green',
    'backgroundLightMintGreen': '--background-light-mint-green',
    'secondaryDefault': '--secondary-default',
    'secondaryDisabled': '--secondary-disabled',
    'primaryCTADefault': '--primary-cta-default',
    'alertErrorDefault': '--alert-error-default',
    'alertSuccessDefault': '--alert-success-default',
    'alertWarningDefault': '--alert-warning-default',

    // Semantic aliases
    'primary': '--text-global-primary',
    'secondary': '--text-global-secondary',
    'card': '--background-light-card',
    'backgroundPrimary': '--background-light',
    'accentPrimary': '--primary-cta-default',
  };

  return colorMap[iosColorName] || `--${iosColorName.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
}

/**
 * Map iOS font names to CSS class names
 */
export function mapIOSFontToClassName(iosFontName: string): string {
  const fontMap: Record<string, string> = {
    'pelagoDisplay': 'pelago-display',
    'pelagoHeader1': 'pelago-header-1',
    'pelagoHeader2': 'pelago-header-2',
    'pelagoHeader3': 'pelago-header-3',
    'pelagoBody1Bold': 'pelago-body-1-bold',
    'pelagoBody1Medium': 'pelago-body-1-medium',
    'pelagoBody1Regular': 'pelago-body-1-regular',
    'pelagoBody1Serif': 'pelago-body-1-serif',
    'pelagoBody2Bold': 'pelago-body-2-bold',
    'pelagoBody2Medium': 'pelago-body-2-medium',
    'pelagoBody2Regular': 'pelago-body-2-regular',
    'pelagoBody2Serif': 'pelago-body-2-serif',
    'pelagoBody3Regular': 'pelago-body-3-regular',
    'pelagoCaption1Bold': 'pelago-caption-1-bold',
    'pelagoCaption2Bold': 'pelago-caption-2-bold',
    'pelagoCaption2Regular': 'pelago-caption-2-regular',
    'pelagoButton1Bold': 'pelago-button-1-bold',
    'pelagoButton2Bold': 'pelago-button-2-bold',
    
    // Style aliases
    'heading1': 'pelago-header-1',
    'heading2': 'pelago-header-2',
    'heading3': 'pelago-header-3',
    'heading4': 'pelago-header-3',
    'body1': 'pelago-body-1-regular',
    'body2': 'pelago-body-2-regular',
    'caption': 'pelago-caption-2-regular',
  };

  return fontMap[iosFontName] || iosFontName;
}

