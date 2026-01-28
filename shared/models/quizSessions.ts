import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { journeys } from "./journeys";

export const quizSessions = pgTable("quiz_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().unique(),
  journeyId: varchar("journey_id").references(() => journeys.id, { onDelete: "set null" }),
  journeyName: varchar("journey_name"),
  answers: jsonb("answers").notNull().default({}),
  state: jsonb("state").notNull().default({}),
  currentAgentId: varchar("current_agent_id"),
  currentScreenId: varchar("current_screen_id"),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type QuizSession = typeof quizSessions.$inferSelect;
export type InsertQuizSession = typeof quizSessions.$inferInsert;
