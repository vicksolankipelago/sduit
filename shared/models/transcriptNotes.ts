import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { voiceSessions } from "./voiceSessions";

export const transcriptNotes = pgTable("transcript_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => voiceSessions.id, { onDelete: "cascade" }),
  messageIndex: integer("message_index").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userRole: varchar("user_role").notNull(),
  userName: varchar("user_name").notNull(),
  content: text("content").notNull(),
  status: varchar("status").notNull().default("todo"),
  parentId: varchar("parent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type TranscriptNote = typeof transcriptNotes.$inferSelect;
export type InsertTranscriptNote = typeof transcriptNotes.$inferInsert;
