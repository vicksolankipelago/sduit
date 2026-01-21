import { journeys, journeyVersions, type Journey, type InsertJourney, type JourneyVersion, type InsertJourneyVersion } from "../shared/models/journeys";
import { voiceSessions, type VoiceSession, type InsertVoiceSession } from "../shared/models/voiceSessions";
import { db } from "./db";
import { eq, desc, count } from "drizzle-orm";

export interface TranscriptMessage {
  itemId: string;
  type: "MESSAGE" | "BREADCRUMB";
  role?: "user" | "assistant";
  title?: string;
  data?: Record<string, any>;
  expanded: boolean;
  timestamp: string;
  createdAtMs: number;
  status: "IN_PROGRESS" | "DONE";
  isHidden: boolean;
}

export interface UpsertSessionMessageParams {
  userId: string;
  sessionId: string;
  message: TranscriptMessage;
  journeyId?: string;
  journeyName?: string;
  journeyVoice?: string;
  agentId?: string;
  agentName?: string;
  agentPrompt?: string;
  agentTools?: any[];
}

export interface IStorage {
  listUserJourneys(userId: string): Promise<Journey[]>;
  getJourney(journeyId: string): Promise<Journey | undefined>;
  createJourney(journey: InsertJourney): Promise<Journey>;
  updateJourney(journeyId: string, journey: Partial<InsertJourney>, userId: string, changeNotes?: string): Promise<Journey | undefined>;
  deleteJourney(journeyId: string): Promise<boolean>;
  
  listJourneyVersions(journeyId: string): Promise<JourneyVersion[]>;
  getJourneyVersion(versionId: string): Promise<JourneyVersion | undefined>;
  getLatestVersionNumber(journeyId: string): Promise<number>;
  
  listUserSessions(userId: string, limit?: number, offset?: number): Promise<VoiceSession[]>;
  getSession(sessionId: string): Promise<VoiceSession | undefined>;
  getSessionById(id: string): Promise<VoiceSession | undefined>;
  saveSession(session: InsertVoiceSession): Promise<VoiceSession>;
  upsertSessionMessage(params: UpsertSessionMessageParams): Promise<VoiceSession>;
  deleteSession(sessionId: string): Promise<boolean>;
  getSessionCount(userId: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async listUserJourneys(userId: string): Promise<Journey[]> {
    return await db.select().from(journeys).where(eq(journeys.userId, userId)).orderBy(desc(journeys.updatedAt));
  }

  async getJourney(journeyId: string): Promise<Journey | undefined> {
    const [journey] = await db.select().from(journeys).where(eq(journeys.id, journeyId));
    return journey;
  }

  async createJourney(journey: InsertJourney): Promise<Journey> {
    const [created] = await db.insert(journeys).values(journey).returning();
    
    // Create initial version (version 1)
    await db.insert(journeyVersions).values({
      journeyId: created.id,
      userId: created.userId,
      versionNumber: 1,
      name: created.name,
      description: created.description || "",
      systemPrompt: created.systemPrompt,
      voice: created.voice,
      agents: created.agents,
      startingAgentId: created.startingAgentId,
      changeNotes: "Initial version",
    });
    
    return created;
  }

  async updateJourney(journeyId: string, updates: Partial<InsertJourney>, userId: string, changeNotes?: string): Promise<Journey | undefined> {
    // Get the current version number
    const latestVersion = await this.getLatestVersionNumber(journeyId);
    
    // Update the journey
    const [updated] = await db
      .update(journeys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(journeys.id, journeyId))
      .returning();
    
    if (updated) {
      // Create a new version entry
      await db.insert(journeyVersions).values({
        journeyId: updated.id,
        userId,
        versionNumber: latestVersion + 1,
        name: updated.name,
        description: updated.description || "",
        systemPrompt: updated.systemPrompt,
        voice: updated.voice,
        agents: updated.agents,
        startingAgentId: updated.startingAgentId,
        changeNotes: changeNotes || "Updated journey",
      });
    }
    
    return updated;
  }

  async deleteJourney(journeyId: string): Promise<boolean> {
    await db.delete(journeys).where(eq(journeys.id, journeyId));
    return true;
  }
  
  async listJourneyVersions(journeyId: string): Promise<JourneyVersion[]> {
    return await db
      .select()
      .from(journeyVersions)
      .where(eq(journeyVersions.journeyId, journeyId))
      .orderBy(desc(journeyVersions.versionNumber));
  }
  
  async getJourneyVersion(versionId: string): Promise<JourneyVersion | undefined> {
    const [version] = await db
      .select()
      .from(journeyVersions)
      .where(eq(journeyVersions.id, versionId));
    return version;
  }
  
  async getLatestVersionNumber(journeyId: string): Promise<number> {
    const versions = await db
      .select({ versionNumber: journeyVersions.versionNumber })
      .from(journeyVersions)
      .where(eq(journeyVersions.journeyId, journeyId))
      .orderBy(desc(journeyVersions.versionNumber))
      .limit(1);
    
    return versions.length > 0 ? versions[0].versionNumber : 0;
  }

  async listUserSessions(userId: string, limit = 50, offset = 0): Promise<VoiceSession[]> {
    return await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.userId, userId))
      .orderBy(desc(voiceSessions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getSession(sessionId: string): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.sessionId, sessionId));
    return session;
  }

  async getSessionById(id: string): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.id, id));
    return session;
  }

  async saveSession(session: InsertVoiceSession): Promise<VoiceSession> {
    const [saved] = await db
      .insert(voiceSessions)
      .values(session)
      .onConflictDoUpdate({
        target: voiceSessions.sessionId,
        set: {
          ...session,
        },
      })
      .returning();
    return saved;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    await db.delete(voiceSessions).where(eq(voiceSessions.sessionId, sessionId));
    return true;
  }

  async getSessionCount(userId: string): Promise<number> {
    const sessions = await db.select().from(voiceSessions).where(eq(voiceSessions.userId, userId));
    return sessions.length;
  }

  async upsertSessionMessage(params: UpsertSessionMessageParams): Promise<VoiceSession> {
    const { userId, sessionId, message, journeyId, journeyName, journeyVoice, agentId, agentName, agentPrompt, agentTools } = params;
    
    const existingSession = await this.getSession(sessionId);
    
    if (existingSession) {
      const existingTranscript = (existingSession.transcript || []) as TranscriptMessage[];
      const existingIndex = existingTranscript.findIndex(m => m.itemId === message.itemId);
      
      let updatedTranscript: TranscriptMessage[];
      if (existingIndex >= 0) {
        updatedTranscript = [...existingTranscript];
        updatedTranscript[existingIndex] = message;
      } else {
        updatedTranscript = [...existingTranscript, message];
      }
      
      const messages = updatedTranscript.filter(t => t.type === 'MESSAGE' && t.status === 'DONE' && t.title);
      const userMessages = messages.filter(t => t.role === 'user');
      const assistantMessages = messages.filter(t => t.role === 'assistant');
      const breadcrumbs = updatedTranscript.filter(t => t.type === 'BREADCRUMB');
      
      const messageTimes = updatedTranscript.filter(t => t.createdAtMs).map(t => t.createdAtMs);
      const startMs = messageTimes.length > 0 ? Math.min(...messageTimes) : Date.now();
      const endMs = messageTimes.length > 0 ? Math.max(...messageTimes) : Date.now();
      
      const [updated] = await db
        .update(voiceSessions)
        .set({
          transcript: updatedTranscript,
          exportedAt: new Date(),
          durationStartMs: startMs,
          durationEndMs: endMs,
          durationTotalSeconds: Math.round((endMs - startMs) / 1000),
          statsTotalMessages: messages.length,
          statsUserMessages: userMessages.length,
          statsAssistantMessages: assistantMessages.length,
          statsBreadcrumbs: breadcrumbs.length,
        })
        .where(eq(voiceSessions.sessionId, sessionId))
        .returning();
      return updated;
    } else {
      const messages = message.type === 'MESSAGE' && message.status === 'DONE' && message.title ? [message] : [];
      const userMessages = messages.filter(t => t.role === 'user');
      const assistantMessages = messages.filter(t => t.role === 'assistant');
      
      const [created] = await db
        .insert(voiceSessions)
        .values({
          userId,
          sessionId,
          exportedAt: new Date(),
          transcript: [message],
          events: [],
          durationStartMs: message.createdAtMs,
          durationEndMs: message.createdAtMs,
          durationTotalSeconds: 0,
          journeyId,
          journeyName,
          journeyVoice,
          agentId,
          agentName,
          agentPrompt,
          agentTools: agentTools || [],
          statsTotalMessages: messages.length,
          statsUserMessages: userMessages.length,
          statsAssistantMessages: assistantMessages.length,
          statsToolCalls: 0,
          statsBreadcrumbs: message.type === 'BREADCRUMB' ? 1 : 0,
        })
        .returning();
      return created;
    }
  }
}

export const storage = new DatabaseStorage();
