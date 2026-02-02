/**
 * Prolific Integration Utilities
 *
 * Handles capturing Prolific URL parameters and API interactions
 * for external research studies.
 *
 * URL Parameters from Prolific:
 * - PROLIFIC_PID: Unique participant ID
 * - SESSION_ID: Submission session ID
 * - STUDY_ID: Study ID
 */

const PROLIFIC_API_BASE = 'https://api.prolific.com';

export interface ProlificParams {
  prolificPid: string | null;
  sessionId: string | null;
  studyId: string | null;
}

export interface ProlificSession {
  params: ProlificParams;
  capturedAt: string;
  journeyId: string;
}

const STORAGE_KEY = 'prolific_session';

/**
 * Capture Prolific parameters from the current URL
 * Call this when a journey loads to capture participant info
 */
export function captureProlificParams(): ProlificParams {
  const urlParams = new URLSearchParams(window.location.search);

  const params: ProlificParams = {
    prolificPid: urlParams.get('PROLIFIC_PID'),
    sessionId: urlParams.get('SESSION_ID'),
    studyId: urlParams.get('STUDY_ID'),
  };

  console.log('[Prolific] Captured URL params:', params);
  return params;
}

/**
 * Check if current URL has Prolific parameters
 */
export function hasProlificParams(): boolean {
  const params = captureProlificParams();
  return !!(params.prolificPid && params.sessionId);
}

/**
 * Store Prolific session data for later use
 */
export function storeProlificSession(journeyId: string, params: ProlificParams): void {
  const session: ProlificSession = {
    params,
    capturedAt: new Date().toISOString(),
    journeyId,
  };

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  console.log('[Prolific] Session stored:', session);
}

/**
 * Retrieve stored Prolific session
 */
export function getProlificSession(): ProlificSession | null {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as ProlificSession;
  } catch {
    return null;
  }
}

/**
 * Clear stored Prolific session
 */
export function clearProlificSession(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  console.log('[Prolific] Session cleared');
}

/**
 * Prolific participant outcome types
 */
export type ProlificOutcome = 'completed' | 'screened_out';

/**
 * Get the redirect URL for Prolific based on outcome
 * All outcomes use the same URL format with different completion codes
 */
export function getProlificRedirectUrl(completionCode: string): string {
  return `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(completionCode)}`;
}

/**
 * Get the completion redirect URL for Prolific (alias for backwards compatibility)
 */
export function getProlificCompletionUrl(completionCode: string): string {
  return getProlificRedirectUrl(completionCode);
}

/**
 * Redirect participant to Prolific with the appropriate completion code
 * @param outcome - The participant outcome ('completed' or 'screened_out')
 * @param codes - Object containing completionCode and/or screenOutCode
 */
export function redirectToProlific(
  outcome: ProlificOutcome,
  codes: { completionCode?: string; screenOutCode?: string }
): void {
  const code = outcome === 'screened_out' ? codes.screenOutCode : codes.completionCode;

  if (!code) {
    console.error(`[Prolific] No ${outcome === 'screened_out' ? 'screen-out' : 'completion'} code configured`);
    return;
  }

  const url = getProlificRedirectUrl(code);
  console.log(`[Prolific] Redirecting (${outcome}):`, url);
  window.location.href = url;
}

/**
 * Redirect participant to Prolific completion page (backwards compatible)
 */
export function redirectToProlificCompletion(completionCode: string): void {
  redirectToProlific('completed', { completionCode });
}

/**
 * Redirect screened-out participant to Prolific
 */
export function redirectToProlificScreenOut(screenOutCode: string): void {
  redirectToProlific('screened_out', { screenOutCode });
}

/**
 * Prolific API client for server-side operations
 * Note: API token should be kept server-side for security
 */
export class ProlificApi {
  private apiToken: string;
  private baseUrl: string;

  constructor(apiToken: string, baseUrl: string = PROLIFIC_API_BASE) {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Prolific API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Get submissions for a study
   */
  async getSubmissions(studyId: string): Promise<any> {
    return this.request(`/api/v1/studies/${studyId}/submissions/`);
  }

  /**
   * Approve a submission
   */
  async approveSubmission(submissionId: string): Promise<any> {
    return this.request(`/api/v1/submissions/${submissionId}/transition/`, {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE' }),
    });
  }

  /**
   * Reject a submission
   */
  async rejectSubmission(submissionId: string, reason: string): Promise<any> {
    return this.request(`/api/v1/submissions/${submissionId}/transition/`, {
      method: 'POST',
      body: JSON.stringify({ action: 'REJECT', rejection_reason: reason }),
    });
  }

  /**
   * Get study details
   */
  async getStudy(studyId: string): Promise<any> {
    return this.request(`/api/v1/studies/${studyId}/`);
  }
}

/**
 * Handle journey outcome for Prolific participants
 * Called when the journey ends (completed or screened out)
 *
 * @param options.outcome - 'completed' or 'screened_out'
 * @param options.completionCode - Code for successful completion
 * @param options.screenOutCode - Code for screened-out participants
 * @param options.autoApprove - Whether to auto-approve via API
 * @param options.apiToken - Prolific API token (for auto-approve)
 */
export async function handleProlificCompletion(options: {
  outcome?: ProlificOutcome;
  completionCode?: string;
  screenOutCode?: string;
  autoApprove?: boolean;
  apiToken?: string;
}): Promise<void> {
  const session = getProlificSession();

  if (!session || !session.params.prolificPid) {
    console.log('[Prolific] No Prolific session found, skipping');
    return;
  }

  const outcome = options.outcome || 'completed';
  console.log(`[Prolific] Handling ${outcome} for participant:`, session.params.prolificPid);

  // If auto-approve is enabled and we have an API token, approve the submission
  if (options.autoApprove && options.apiToken && session.params.sessionId) {
    try {
      const api = new ProlificApi(options.apiToken);
      await api.approveSubmission(session.params.sessionId);
      console.log('[Prolific] Submission auto-approved');
    } catch (error) {
      console.error('[Prolific] Failed to auto-approve submission:', error);
    }
  }

  // Clear the session
  clearProlificSession();

  // Redirect based on outcome
  redirectToProlific(outcome, {
    completionCode: options.completionCode,
    screenOutCode: options.screenOutCode,
  });
}

/**
 * Handle screen-out for Prolific participants
 * Convenience function for screening out participants
 */
export async function handleProlificScreenOut(screenOutCode: string): Promise<void> {
  return handleProlificCompletion({
    outcome: 'screened_out',
    screenOutCode,
  });
}
