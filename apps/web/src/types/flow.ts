import type {
  Journey,
  JourneyListItem,
  JourneyExport,
  PublishedJourney,
  JourneyAiProposalRequest,
  JourneyAiProposalResponse,
  JourneyAiProposalApplyRequest,
  JourneyAiProposalApplyResponse,
} from './journey';

// Flow naming aliases for incremental migration from "journey" terminology.
export type Flow = Journey;
export type FlowListItem = JourneyListItem;
export type FlowExport = JourneyExport;
export type PublishedFlow = PublishedJourney;
export type FlowAiProposalRequest = JourneyAiProposalRequest;
export type FlowAiProposalResponse = JourneyAiProposalResponse;
export type FlowAiProposalApplyRequest = JourneyAiProposalApplyRequest;
export type FlowAiProposalApplyResponse = JourneyAiProposalApplyResponse;
