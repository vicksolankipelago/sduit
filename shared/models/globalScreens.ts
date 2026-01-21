import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./auth";

// Global screens table for storing shared SDUI screen configurations
export const globalScreens = pgTable("global_screens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title").notNull(),
  description: text("description").default(""),
  tags: jsonb("tags").notNull().default([]),
  sections: jsonb("sections").notNull().default([]),
  events: jsonb("events").notNull().default([]),
  state: jsonb("state").notNull().default({}),
  hidesBackButton: boolean("hides_back_button").notNull().default(false),
  version: varchar("version").notNull().default("1.0.0"),
  createdBy: varchar("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type GlobalScreen = typeof globalScreens.$inferSelect;
export type InsertGlobalScreen = typeof globalScreens.$inferInsert;
