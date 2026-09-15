import { createInsertSchema } from "drizzle-zod";
import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const activityEventTypeEnum = [
  "session_connected",
  "session_created",
  "session_disconnected",
  "session_logged_out",
  "session_error",
  "message_received",
] as const;

export const activityEventsTable = pgTable("activity_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  sessionId: uuid("session_id"),
  sessionName: text("session_name"),
  type: text("type", { enum: activityEventTypeEnum }).notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActivityEventSchema = createInsertSchema(
  activityEventsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;
export type ActivityEvent = typeof activityEventsTable.$inferSelect;