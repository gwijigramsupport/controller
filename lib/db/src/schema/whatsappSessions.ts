import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const sessionStatusEnum = [
  "connected",
  "connecting",
  "disconnected",
  "logged_out",
  "error",
] as const;

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
  displayNumber: text("display_number"),
  profileName: text("profile_name"),
  status: text("status", { enum: sessionStatusEnum })
    .notNull()
    .default("disconnected"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  messageCount: integer("message_count").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWhatsappSessionSchema = createInsertSchema(
  whatsappSessionsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWhatsappSession = z.infer<
  typeof insertWhatsappSessionSchema
>;
export type WhatsappSession = typeof whatsappSessionsTable.$inferSelect;