/**
 * Available illustrations in the project
 * These are SVG illustrations from assets/illustrations/
 */

export const COLOUR_ILLUSTRATIONS = [
  'ColourBeingActive',
  'ColourBreathalyser',
  'ColourCareTeamAtWorkEmotional',
  'ColourCareTeamAtWorkFunctional',
  'ColourCyclist',
  'ColourFamily',
  'ColourFeelingSupport',
  'ColourGettingStartedBeach',
  'ColourGettingStartedBoat',
  'ColourHomeDelivery',
  'ColourHowToUseIt',
  'ColourHumanEmotions',
  'ColourIceCreamFail',
  'ColourManThumbsUp',
  'ColourManWaving',
  'ColourMemberTakingMedicationAlcohol',
  'ColourMemberTakingMedicationTobacco',
  'ColourMemberTakingUrineTest',
  'ColourMemberUsingApp',
  'ColourMemberUsingAppBlue',
  'ColourMindfulnessActivitiesAndRelaxing',
  'ColourNotifications',
  'ColourOvercomingObstacles',
  'ColourProgress',
  'ColourReadingBook',
  'ColourRelapse',
  'ColourRelationshipInteraction',
  'ColourSaveMoney',
  'ColourSettingGoalsArchery',
  'ColourSettingGoalsCalendar',
  'ColourSuccess',
  'ColourWalking',
  'ColourWomanThumbsUp',
  'ColourWomanThumbsUp2',
] as const;

export const MONO_ILLUSTRATIONS = [
  'MonoBeingActive',
  'MonoBreathalyser',
  'MonoCareTeamAtWorkEmotional',
  'MonoCareTeamAtWorkFunctional',
  'MonoCyclist',
  'MonoFamily',
  'MonoFeelingSupport',
  'MonoGettingStartedBeach',
  'MonoGettingStartedBoat',
  'MonoHomeDelivery',
  'MonoHowToUseIt',
  'MonoHumanEmotions',
  'MonoIceCreamFail',
  'MonoManThumbsUp',
  'MonoManWaving',
  'MonoMemberTakingMedicationAlcohol',
  'MonoMemberTakingMedicationTobacco',
  'MonoMemberTakingUrineTest',
  'MonoMemberUsingApp',
  'MonoMindfulnessActivitiesAndRelaxing',
  'MonoNotifications',
  'MonoOvercomingObstacles',
  'MonoProgress',
  'MonoReadingBook',
  'MonoRelapse',
  'MonoRelationshipInteraction',
  'MonoSaveMoney',
  'MonoSettingGoalsArchery',
  'MonoSettingGoalsCalendar',
  'MonoSuccess',
  'MonoTarget',
  'MonoWalking',
  'MonoWomanThumbsUp',
  'MonoWomanThumbsUp2',
] as const;

export const ALL_ILLUSTRATIONS = [...COLOUR_ILLUSTRATIONS, ...MONO_ILLUSTRATIONS] as const;

export type IllustrationName = typeof ALL_ILLUSTRATIONS[number];

/**
 * Get a human-readable label from an illustration name
 */
export function getIllustrationLabel(name: string): string {
  return name
    .replace(/^Colour/, '')
    .replace(/^Mono/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
}
