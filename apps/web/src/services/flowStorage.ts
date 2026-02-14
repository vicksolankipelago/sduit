import type { Flow, FlowExport, FlowListItem } from '../types/flow';
import {
  clearAllJourneys,
  deleteJourney,
  downloadJourneyAsJSON,
  duplicateJourney,
  exportJourney,
  getLastProductionLoadError,
  importJourney,
  isProduction,
  listJourneys,
  listJourneysForRuntime,
  listJourneysSync,
  listProductionJourneys,
  loadJourney,
  loadJourneyForRuntime,
  loadProductionJourney,
  resetEnvironmentCache,
  saveJourney,
} from './journeyStorage';

// Incremental storage aliases so flow terminology can be adopted without
// forcing a breaking rename across the codebase.
export async function listFlows(): Promise<FlowListItem[]> {
  return listJourneys();
}

export function listFlowsSync(): FlowListItem[] {
  return listJourneysSync();
}

export async function loadFlow(id: string): Promise<Flow | null> {
  return loadJourney(id);
}

export async function saveFlow(flow: Flow): Promise<Flow | null> {
  return saveJourney(flow);
}

export async function deleteFlow(id: string): Promise<boolean> {
  return deleteJourney(id);
}

export async function duplicateFlow(id: string): Promise<Flow | null> {
  return duplicateJourney(id);
}

export async function exportFlow(id: string): Promise<FlowExport | null> {
  return exportJourney(id) as Promise<FlowExport | null>;
}

export async function downloadFlowAsJSON(id: string): Promise<void> {
  return downloadJourneyAsJSON(id);
}

export async function importFlow(jsonString: string): Promise<Flow | null> {
  return importJourney(jsonString) as Promise<Flow | null>;
}

export function clearAllFlows(): boolean {
  return clearAllJourneys();
}

export async function listProductionFlows(): Promise<FlowListItem[]> {
  return listProductionJourneys();
}

export async function loadProductionFlow(id: string): Promise<Flow | null> {
  return loadProductionJourney(id) as Promise<Flow | null>;
}

export async function listFlowsForRuntime(): Promise<FlowListItem[]> {
  return listJourneysForRuntime();
}

export async function loadFlowForRuntime(id: string): Promise<Flow | null> {
  return loadJourneyForRuntime(id) as Promise<Flow | null>;
}

export {
  getLastProductionLoadError,
  isProduction,
  resetEnvironmentCache,
};
