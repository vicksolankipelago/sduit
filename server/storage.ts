import { journeys, journeyVersions, publishedJourneys, type Journey, type InsertJourney, type JourneyVersion, type InsertJourneyVersion, type PublishedJourney, type InsertPublishedJourney } from "../shared/models/journeys";
import { voiceSessions, type VoiceSession, type InsertVoiceSession } from "../shared/models/voiceSessions";
import { globalScreens, type GlobalScreen, type InsertGlobalScreen } from "../shared/models/globalScreens";
import { transcriptNotes, type TranscriptNote, type InsertTranscriptNote } from "../shared/models/transcriptNotes";
import { users } from "../shared/models/auth";
import { db } from "./db";
import { eq, desc, count, and, isNull, asc } from "drizzle-orm";

export interface VoiceSessionWithUser extends VoiceSession {
  userName?: string;
}

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
  prolificPid?: string;
  prolificStudyId?: string;
  prolificSessionId?: string;
}

export interface IStorage {
  listUserJourneys(userId: string): Promise<Journey[]>;
  listAllJourneys(): Promise<Journey[]>;
  getJourney(journeyId: string): Promise<Journey | undefined>;
  createJourney(journey: InsertJourney): Promise<Journey>;
  updateJourney(journeyId: string, journey: Partial<InsertJourney>, userId: string, changeNotes?: string): Promise<Journey | undefined>;
  deleteJourney(journeyId: string): Promise<boolean>;
  
  // Publishing methods
  publishJourney(journeyId: string, userId: string): Promise<PublishedJourney | undefined>;
  unpublishJourney(journeyId: string): Promise<boolean>;
  getPublishedJourney(journeyId: string): Promise<PublishedJourney | undefined>;
  listPublishedJourneys(): Promise<PublishedJourney[]>;
  
  listJourneyVersions(journeyId: string): Promise<JourneyVersion[]>;
  getJourneyVersion(versionId: string): Promise<JourneyVersion | undefined>;
  getLatestVersionNumber(journeyId: string): Promise<number>;
  
  listUserSessions(userId: string, limit?: number, offset?: number): Promise<VoiceSessionWithUser[]>;
  listAllSessions(limit?: number, offset?: number): Promise<VoiceSessionWithUser[]>;
  getSession(sessionId: string): Promise<VoiceSession | undefined>;
  getSessionById(id: string): Promise<VoiceSession | undefined>;
  getSessionBySessionId(sessionId: string): Promise<VoiceSession | undefined>;
  saveSession(session: InsertVoiceSession): Promise<VoiceSession>;
  upsertSessionMessage(params: UpsertSessionMessageParams): Promise<VoiceSession>;
  deleteSession(sessionId: string): Promise<boolean>;
  getSessionCount(userId: string): Promise<number>;
  getSessionsByJourneyId(journeyId: string, limit?: number): Promise<VoiceSession[]>;

  // Global screens
  listGlobalScreens(): Promise<GlobalScreen[]>;
  getGlobalScreen(screenId: string): Promise<GlobalScreen | undefined>;
  createGlobalScreen(screen: InsertGlobalScreen): Promise<GlobalScreen>;
  updateGlobalScreen(screenId: string, screen: Partial<InsertGlobalScreen>): Promise<GlobalScreen | undefined>;
  deleteGlobalScreen(screenId: string): Promise<boolean>;

  // Transcript notes
  listSessionNotes(sessionId: string): Promise<TranscriptNote[]>;
  getNote(noteId: string): Promise<TranscriptNote | undefined>;
  createNote(note: InsertTranscriptNote): Promise<TranscriptNote>;
  updateNote(noteId: string, updates: Partial<InsertTranscriptNote>): Promise<TranscriptNote | undefined>;
  deleteNote(noteId: string): Promise<boolean>;
  deleteNoteWithReplies(noteId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async listUserJourneys(userId: string): Promise<Journey[]> {
    return await db.select().from(journeys).where(eq(journeys.userId, userId)).orderBy(desc(journeys.updatedAt));
  }

  async listAllJourneys(): Promise<Journey[]> {
    return await db.select().from(journeys).orderBy(desc(journeys.updatedAt));
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

  async publishJourney(journeyId: string, userId: string): Promise<PublishedJourney | undefined> {
    const journey = await this.getJourney(journeyId);
    if (!journey) return undefined;

    // Check if there's already a published version
    const existing = await this.getPublishedJourney(journeyId);
    
    if (existing) {
      // Update existing published version
      const [updated] = await db
        .update(publishedJourneys)
        .set({
          name: journey.name,
          description: journey.description || "",
          systemPrompt: journey.systemPrompt,
          voice: journey.voice,
          agents: journey.agents,
          startingAgentId: journey.startingAgentId,
          version: journey.version,
          publishedAt: new Date(),
          publishedByUserId: userId,
        })
        .where(eq(publishedJourneys.journeyId, journeyId))
        .returning();
      
      // Update the journey's published status
      await db
        .update(journeys)
        .set({ isPublished: true, publishedAt: new Date(), status: "published" })
        .where(eq(journeys.id, journeyId));
      
      return updated;
    } else {
      // Create new published version
      const [created] = await db
        .insert(publishedJourneys)
        .values({
          journeyId: journey.id,
          userId: journey.userId,
          name: journey.name,
          description: journey.description || "",
          systemPrompt: journey.systemPrompt,
          voice: journey.voice,
          agents: journey.agents,
          startingAgentId: journey.startingAgentId,
          version: journey.version,
          publishedByUserId: userId,
        })
        .returning();
      
      // Update the journey's published status
      await db
        .update(journeys)
        .set({ isPublished: true, publishedAt: new Date(), status: "published" })
        .where(eq(journeys.id, journeyId));
      
      return created;
    }
  }

  async unpublishJourney(journeyId: string): Promise<boolean> {
    await db.delete(publishedJourneys).where(eq(publishedJourneys.journeyId, journeyId));
    
    // Update the journey's published status
    await db
      .update(journeys)
      .set({ isPublished: false, publishedAt: null, status: "draft" })
      .where(eq(journeys.id, journeyId));
    
    return true;
  }

  async getPublishedJourney(journeyId: string): Promise<PublishedJourney | undefined> {
    const [published] = await db
      .select()
      .from(publishedJourneys)
      .where(eq(publishedJourneys.journeyId, journeyId));
    return published;
  }

  async listPublishedJourneys(): Promise<PublishedJourney[]> {
    return await db.select().from(publishedJourneys).orderBy(desc(publishedJourneys.publishedAt));
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

  async listUserSessions(userId: string, limit = 50, offset = 0): Promise<VoiceSessionWithUser[]> {
    const results = await db
      .select({
        session: voiceSessions,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(voiceSessions)
      .leftJoin(users, eq(voiceSessions.userId, users.id))
      .where(eq(voiceSessions.userId, userId))
      .orderBy(desc(voiceSessions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return results.map(r => ({
      ...r.session,
      userName: r.firstName && r.lastName 
        ? `${r.firstName} ${r.lastName}`.trim() 
        : r.email || undefined,
    }));
  }

  async listAllSessions(limit = 50, offset = 0): Promise<VoiceSessionWithUser[]> {
    const results = await db
      .select({
        session: voiceSessions,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(voiceSessions)
      .leftJoin(users, eq(voiceSessions.userId, users.id))
      .orderBy(desc(voiceSessions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return results.map(r => ({
      ...r.session,
      userName: r.firstName && r.lastName 
        ? `${r.firstName} ${r.lastName}`.trim() 
        : r.email || undefined,
    }));
  }

  async getSession(sessionId: string): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.sessionId, sessionId));
    return session;
  }

  async getSessionById(id: string): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.id, id));
    return session;
  }

  async getSessionBySessionId(sessionId: string): Promise<VoiceSession | undefined> {
    const [session] = await db.select().from(voiceSessions).where(eq(voiceSessions.sessionId, sessionId));
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

  async getSessionsByJourneyId(journeyId: string, limit = 10): Promise<VoiceSession[]> {
    return await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.journeyId, journeyId))
      .orderBy(desc(voiceSessions.createdAt))
      .limit(limit);
  }

  async upsertSessionMessage(params: UpsertSessionMessageParams): Promise<VoiceSession> {
    const { userId, sessionId, message, journeyId, journeyName, journeyVoice, agentId, agentName, agentPrompt, agentTools, prolificPid, prolificStudyId, prolificSessionId } = params;
    
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
          prolificPid,
          prolificStudyId,
          prolificSessionId,
        })
        .returning();
      return created;
    }
  }

  // Global screens methods
  async listGlobalScreens(): Promise<GlobalScreen[]> {
    return await db.select().from(globalScreens).orderBy(desc(globalScreens.updatedAt));
  }

  async getGlobalScreen(screenId: string): Promise<GlobalScreen | undefined> {
    const [screen] = await db.select().from(globalScreens).where(eq(globalScreens.id, screenId));
    return screen;
  }

  async createGlobalScreen(screen: InsertGlobalScreen): Promise<GlobalScreen> {
    const [created] = await db.insert(globalScreens).values(screen).returning();
    return created;
  }

  async updateGlobalScreen(screenId: string, updates: Partial<InsertGlobalScreen>): Promise<GlobalScreen | undefined> {
    const [updated] = await db
      .update(globalScreens)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(globalScreens.id, screenId))
      .returning();
    return updated;
  }

  async deleteGlobalScreen(screenId: string): Promise<boolean> {
    await db.delete(globalScreens).where(eq(globalScreens.id, screenId));
    return true;
  }

  // Transcript notes methods
  async listSessionNotes(sessionId: string): Promise<TranscriptNote[]> {
    return await db
      .select()
      .from(transcriptNotes)
      .where(eq(transcriptNotes.sessionId, sessionId))
      .orderBy(asc(transcriptNotes.createdAt));
  }

  async getNote(noteId: string): Promise<TranscriptNote | undefined> {
    const [note] = await db.select().from(transcriptNotes).where(eq(transcriptNotes.id, noteId));
    return note;
  }

  async createNote(note: InsertTranscriptNote): Promise<TranscriptNote> {
    const [created] = await db.insert(transcriptNotes).values(note).returning();
    return created;
  }

  async updateNote(noteId: string, updates: Partial<InsertTranscriptNote>): Promise<TranscriptNote | undefined> {
    const [updated] = await db
      .update(transcriptNotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transcriptNotes.id, noteId))
      .returning();
    return updated;
  }

  async deleteNote(noteId: string): Promise<boolean> {
    await db.delete(transcriptNotes).where(eq(transcriptNotes.id, noteId));
    return true;
  }

  async deleteNoteWithReplies(noteId: string): Promise<boolean> {
    await db.delete(transcriptNotes).where(eq(transcriptNotes.parentId, noteId));
    await db.delete(transcriptNotes).where(eq(transcriptNotes.id, noteId));
    return true;
  }

  async countSessionNotes(sessionId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(transcriptNotes)
      .where(eq(transcriptNotes.sessionId, sessionId));
    return result?.count || 0;
  }

  async countNotesForSessions(sessionIds: string[]): Promise<Record<string, number>> {
    if (sessionIds.length === 0) return {};
    
    const notes = await db
      .select({ sessionId: transcriptNotes.sessionId })
      .from(transcriptNotes);
    
    const counts: Record<string, number> = {};
    for (const id of sessionIds) {
      counts[id] = 0;
    }
    for (const note of notes) {
      if (sessionIds.includes(note.sessionId)) {
        counts[note.sessionId] = (counts[note.sessionId] || 0) + 1;
      }
    }
    return counts;
  }
}

export const storage = new DatabaseStorage();
