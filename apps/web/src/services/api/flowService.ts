import type {
  Flow,
  FlowListItem,
  PublishedFlow,
  FlowAiProposalApplyRequest,
  FlowAiProposalApplyResponse,
  FlowAiProposalRequest,
  FlowAiProposalResponse,
} from '../../types/flow';
import {
  applyJourneyAiProposal,
  createJourney,
  createJourneyAiProposal,
  deleteProductionFlow,
  deleteUserJourney,
  duplicateUserJourney,
  getEnvironment,
  getProductionFlow,
  getPublishedJourney,
  journeyExists,
  listProductionFlows,
  listPublishedJourneys,
  listUserJourneys,
  loadUserJourney,
  publishJourney,
  saveUserJourney,
  unpublishJourney,
  updateProductionFlow,
} from './journeyService';

// Incremental flow-named API facade that delegates to existing journey endpoints.
export async function listFlows(): Promise<FlowListItem[]> {
  return listUserJourneys();
}

export async function loadFlow(flowId: string): Promise<Flow | null> {
  return loadUserJourney(flowId);
}

export async function saveFlow(flow: Flow): Promise<Flow> {
  return saveUserJourney(flow);
}

export async function deleteFlow(flowId: string): Promise<boolean> {
  return deleteUserJourney(flowId);
}

export async function duplicateFlow(flowId: string): Promise<Flow | null> {
  return duplicateUserJourney(flowId);
}

export async function flowExists(flowId: string): Promise<boolean> {
  return journeyExists(flowId);
}

export async function createFlow(flow: Flow): Promise<Flow> {
  return createJourney(flow);
}

export async function publishFlow(flowId: string): Promise<{ success: boolean; publishedJourney?: { id: string; journeyId: string; name: string; publishedAt: string } }> {
  return publishJourney(flowId);
}

export async function unpublishFlow(flowId: string): Promise<{ success: boolean }> {
  return unpublishJourney(flowId);
}

export async function getPublishedFlow(flowId: string): Promise<PublishedFlow | null> {
  return getPublishedJourney(flowId);
}

export async function listPublishedFlows(): Promise<{ id: string; journeyId: string; name: string; description: string; publishedAt: string }[]> {
  return listPublishedJourneys();
}

export async function getFlowEnvironment(): Promise<{ isProduction: boolean; environment: string }> {
  return getEnvironment();
}

export async function createFlowAiProposal(
  flowId: string,
  request: FlowAiProposalRequest
): Promise<FlowAiProposalResponse> {
  return createJourneyAiProposal(flowId, request);
}

export async function applyFlowAiProposal(
  flowId: string,
  proposalId: string,
  request: FlowAiProposalApplyRequest = {}
): Promise<FlowAiProposalApplyResponse> {
  return applyJourneyAiProposal(flowId, proposalId, request);
}

export async function listProductionFlowSnapshots(): Promise<{ journeyId: string; name: string; description: string; publishedAt: string; agentCount?: number }[]> {
  return listProductionFlows();
}

export async function getProductionFlowSnapshot(flowId: string): Promise<PublishedFlow | null> {
  return getProductionFlow(flowId);
}

export async function deleteProductionFlowSnapshot(flowId: string): Promise<boolean> {
  return deleteProductionFlow(flowId);
}

export async function updateProductionFlowSnapshot(flowId: string, updates: Partial<Flow>): Promise<Flow> {
  return updateProductionFlow(flowId, updates);
}
