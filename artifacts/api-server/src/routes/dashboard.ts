import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, activityEventsTable, whatsappSessionsTable } from "@workspace/db";
import { ListActivityQueryParams } from "@workspace/api-zod";
import { getTenantId, requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function activityResponse(
  event: typeof activityEventsTable.$inferSelect,
) {
  return {
    id: event.id,
    sessionId: event.sessionId,
    sessionName: event.sessionName,
    type: event.type,
    title: event.title,
    detail: event.detail,
    createdAt: event.createdAt.toISOString(),
  };
}

function sessionResponse(
  session: typeof whatsappSessionsTable.$inferSelect,
) {
  return {
    id: session.id,
    name: session.name,
    phoneNumber: session.phoneNumber,
    displayNumber: session.displayNumber,
    profileName: session.profileName,
    status: session.status,
    lastSeenAt: session.lastSeenAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messageCount: session.messageCount,
    errorMessage: session.errorMessage,
  };
}

async function seedTenant(ownerId: string) {
  const existing = await db
    .select({ id: whatsappSessionsTable.id })
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.ownerId, ownerId))
    .limit(1);

  if (existing.length > 0) return;

  const [first] = await db
    .insert(whatsappSessionsTable)
    .values([
      {
        ownerId,
        name: "Primary workspace",
        status: "disconnected",
        messageCount: 0,
      },
      {
        ownerId,
        name: "Support line",
        status: "logged_out",
        messageCount: 0,
      },
    ])
    .returning();

  await db.insert(activityEventsTable).values({
    ownerId,
    sessionId: first.id,
    sessionName: first.name,
    type: "session_created",
    title: "Workspace ready",
    detail: "Create a session and pair your first linked WhatsApp device.",
  });
}

router.get("/dashboard", requireAuth, async (_req, res) => {
  const ownerId = getTenantId(res);
  await seedTenant(ownerId);

  const sessions = await db
    .select()
    .from(whatsappSessionsTable)
    .where(eq(whatsappSessionsTable.ownerId, ownerId))
    .orderBy(desc(whatsappSessionsTable.updatedAt));
  const recentActivity = await db
    .select()
    .from(activityEventsTable)
    .where(eq(activityEventsTable.ownerId, ownerId))
    .orderBy(desc(activityEventsTable.createdAt))
    .limit(8);

  const connectedSessions = sessions.filter(
    (session) => session.status === "connected",
  ).length;
  const attentionSessions = sessions.filter((session) =>
    ["error", "logged_out"].includes(session.status),
  ).length;
  const messagesToday = sessions.reduce(
    (total, session) => total + session.messageCount,
    0,
  );

  res.json({
    totalSessions: sessions.length,
    connectedSessions,
    attentionSessions,
    messagesToday,
    uptimePercent: sessions.length
      ? Math.round((connectedSessions / sessions.length) * 1000) / 10
      : 0,
    sessions: sessions.map(sessionResponse),
    recentActivity: recentActivity.map(activityResponse),
  });
});

router.get("/activity", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { limit } = ListActivityQueryParams.parse(req.query);
  const activity = await db
    .select()
    .from(activityEventsTable)
    .where(and(eq(activityEventsTable.ownerId, ownerId)))
    .orderBy(desc(activityEventsTable.createdAt))
    .limit(limit);

  res.json(activity.map(activityResponse));
});

export default router;