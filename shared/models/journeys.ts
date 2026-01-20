import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

// Journeys table for storing SDUI journeys
export const journeys = pgTable("journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description").default(""),
  systemPrompt: text("system_prompt").notNull().default(""),
  voice: varchar("voice"),
  agents: jsonb("agents").notNull().default([]),
  startingAgentId: varchar("starting_agent_id").notNull().default(""),
  version: varchar("version").notNull().default("1.0.0"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Journey = typeof journeys.$inferSelect;
export type InsertJourney = typeof journeys.$inferInsert;
