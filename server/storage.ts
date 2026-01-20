import { journeys, type Journey, type InsertJourney } from "../shared/models/journeys";
import { voiceSessions, type VoiceSession, type InsertVoiceSession } from "../shared/models/voiceSessions";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  listUserJourneys(userId: string): Promise<Journey[]>;
  getJourney(journeyId: string): Promise<Journey | undefined>;
  createJourney(journey: InsertJourney): Promise<Journey>;
  updateJourney(journeyId: string, journey: Partial<InsertJourney>): Promise<Journey | undefined>;
  deleteJourney(journeyId: string): Promise<boolean>;
  
  listUserSessions(userId: string, limit?: number, offset?: number): Promise<VoiceSession[]>;
  getSession(sessionId: string): Promise<VoiceSession | undefined>;
  getSessionById(id: string): Promise<VoiceSession | undefined>;
  saveSession(session: InsertVoiceSession): Promise<VoiceSession>;
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
    return created;
  }

  async updateJourney(journeyId: string, updates: Partial<InsertJourney>): Promise<Journey | undefined> {
    const [updated] = await db
      .update(journeys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(journeys.id, journeyId))
      .returning();
    return updated;
  }

  async deleteJourney(journeyId: string): Promise<boolean> {
    const result = await db.delete(journeys).where(eq(journeys.id, journeyId));
    return true;
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
}

export const storage = new DatabaseStorage();
