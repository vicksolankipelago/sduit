import { JourneyAiProposalScope } from "./journeyAiProposal";

const PROPOSAL_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface JourneyAiStoredProposal {
  proposalId: string;
  journeyId: string;
  createdByUserId: string;
  scope: JourneyAiProposalScope;
  summary: string;
  changedPaths: string[];
  updatedJourneyDraft: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  appliedAt?: string;
}

class JourneyAiProposalStore {
  private readonly proposals = new Map<string, JourneyAiStoredProposal>();

  private nowMs() {
    return Date.now();
  }

  private isExpired(proposal: JourneyAiStoredProposal): boolean {
    return new Date(proposal.expiresAt).getTime() <= this.nowMs();
  }

  private cleanupExpired() {
    const now = this.nowMs();
    for (const [proposalId, proposal] of this.proposals.entries()) {
      if (new Date(proposal.expiresAt).getTime() <= now) {
        this.proposals.delete(proposalId);
      }
    }
  }

  saveProposal(input: {
    proposalId: string;
    journeyId: string;
    createdByUserId: string;
    scope: JourneyAiProposalScope;
    summary: string;
    changedPaths: string[];
    updatedJourneyDraft: Record<string, unknown>;
  }): JourneyAiStoredProposal {
    this.cleanupExpired();

    const createdAt = new Date().toISOString();
    const expiresAt = new Date(this.nowMs() + PROPOSAL_TTL_MS).toISOString();

    const record: JourneyAiStoredProposal = {
      proposalId: input.proposalId,
      journeyId: input.journeyId,
      createdByUserId: input.createdByUserId,
      scope: input.scope,
      summary: input.summary,
      changedPaths: input.changedPaths,
      updatedJourneyDraft: input.updatedJourneyDraft,
      createdAt,
      expiresAt,
    };

    this.proposals.set(record.proposalId, record);
    return record;
  }

  getProposal(proposalId: string): JourneyAiStoredProposal | undefined {
    this.cleanupExpired();
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return undefined;
    if (this.isExpired(proposal)) {
      this.proposals.delete(proposalId);
      return undefined;
    }
    return proposal;
  }

  markApplied(proposalId: string): JourneyAiStoredProposal | undefined {
    const proposal = this.getProposal(proposalId);
    if (!proposal) return undefined;
    if (!proposal.appliedAt) {
      proposal.appliedAt = new Date().toISOString();
      this.proposals.set(proposalId, proposal);
    }
    return proposal;
  }
}

export const journeyAiProposalStore = new JourneyAiProposalStore();
