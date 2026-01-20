import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

// Voice sessions table for storing session transcripts
export const voiceSessions = pgTable("voice_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id").notNull().unique(),
  exportedAt: timestamp("exported_at").notNull(),
  durationStartMs: integer("duration_start_ms"),
  durationEndMs: integer("duration_end_ms"),
  durationTotalSeconds: integer("duration_total_seconds"),
  journeyId: varchar("journey_id"),
  journeyName: varchar("journey_name"),
  journeyVoice: varchar("journey_voice"),
  agentId: varchar("agent_id"),
  agentName: varchar("agent_name"),
  agentPrompt: text("agent_prompt"),
  agentTools: jsonb("agent_tools").default([]),
  transcript: jsonb("transcript").notNull().default([]),
  events: jsonb("events").default([]),
  statsTotalMessages: integer("stats_total_messages").default(0),
  statsUserMessages: integer("stats_user_messages").default(0),
  statsAssistantMessages: integer("stats_assistant_messages").default(0),
  statsToolCalls: integer("stats_tool_calls").default(0),
  statsBreadcrumbs: integer("stats_breadcrumbs").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type VoiceSession = typeof voiceSessions.$inferSelect;
export type InsertVoiceSession = typeof voiceSessions.$inferInsert;
