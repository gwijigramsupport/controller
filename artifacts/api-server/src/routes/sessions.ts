import { Router, type IRouter } from "express";
import {
  CreateSessionBody,
  GetSessionParams,
  ListSessionsQueryParams,
  RequestPairingCodeBody,
  RequestPairingCodeParams,
  ConnectSessionParams,
  DisconnectSessionParams,
  LogoutSessionParams,
  DeleteSessionParams,
} from "@workspace/api-zod";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import {
  activityEventsTable,
  db,
  whatsappSessionsTable,
} from "@workspace/db";
import { getTenantId, requireAuth } from "../middlewares/requireAuth";
import { whatsappSessionManager } from "../lib/whatsappSessionManager";

const router: IRouter = Router();

function toISOString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toSessionResponse(
  session: typeof whatsappSessionsTable.$inferSelect,
) {
  return {
    id: session.id,
    name: session.name,
    phoneNumber: session.phoneNumber,
    displayNumber: session.displayNumber,
    profileName: session.profileName,
    status: session.status,
    lastSeenAt: toISOString(session.lastSeenAt),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messageCount: session.messageCount,
    errorMessage: session.errorMessage,
  };
}

function maskPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  if (digits.length < 5) return phoneNumber;
  return `+${digits.slice(0, 3)} ${"•".repeat(Math.max(0, digits.length - 7))}${digits.slice(-4)}`;
}

async function getOwnedSession(ownerId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(whatsappSessionsTable)
    .where(
      and(
        eq(whatsappSessionsTable.ownerId, ownerId),
        eq(whatsappSessionsTable.id, sessionId),
      ),
    )
    .limit(1);

  return session;
}

async function recordActivity(input: {
  ownerId: string;
  sessionId?: string | null;
  sessionName?: string | null;
  type:
    | "session_connected"
    | "session_created"
    | "session_disconnected"
    | "session_logged_out"
    | "session_error"
    | "message_received";
  title: string;
  detail?: string | null;
}) {
  await db.insert(activityEventsTable).values(input);
}

async function setSessionStatus(
  ownerId: string,
  sessionId: string,
  status: "connected" | "connecting" | "disconnected" | "logged_out" | "error",
  errorMessage: string | null = null,
) {
  const [updated] = await db
    .update(whatsappSessionsTable)
    .set({
      status,
      errorMessage,
      lastSeenAt: status === "connected" ? new Date() : undefined,
    })
    .where(
      and(
        eq(whatsappSessionsTable.ownerId, ownerId),
        eq(whatsappSessionsTable.id, sessionId),
      ),
    )
    .returning();

  return updated;
}

function createConnectionUpdateHandler(ownerId: string, sessionId: string) {
  return async (update: {
    connection?: "open" | "close";
    lastDisconnect?: unknown;
    qr?: string;
  }) => {
    if (update.connection === "open") {
      const session = await setSessionStatus(ownerId, sessionId, "connected");
      if (session) {
        await recordActivity({
          ownerId,
          sessionId,
          sessionName: session.name,
          type: "session_connected",
          title: `${session.name} connected`,
          detail: "The linked device is online and ready.",
        });
      }
      return;
    }

    if (update.connection === "close") {
      const session = await setSessionStatus(
        ownerId,
        sessionId,
        "disconnected",
      );
      if (session) {
        await recordActivity({
          ownerId,
          sessionId,
          sessionName: session.name,
          type: "session_disconnected",
          title: `${session.name} disconnected`,
          detail: "The worker closed its connection and can be restarted.",
        });
      }
    }
  };
}

router.get("/sessions", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const query = ListSessionsQueryParams.parse(req.query);
  const conditions = [eq(whatsappSessionsTable.ownerId, ownerId)];

  if (query.status !== "all") {
    conditions.push(eq(whatsappSessionsTable.status, query.status));
  }

  if (query.search) {
    conditions.push(
      or(
        ilike(whatsappSessionsTable.name, `%${query.search}%`),
        ilike(whatsappSessionsTable.phoneNumber, `%${query.search}%`),
      )!,
    );
  }

  const sessions = await db
    .select()
    .from(whatsappSessionsTable)
    .where(and(...conditions))
    .orderBy(desc(whatsappSessionsTable.updatedAt));

  res.json(sessions.map(toSessionResponse));
});

router.post("/sessions", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const body = CreateSessionBody.parse(req.body);
  const [session] = await db
    .insert(whatsappSessionsTable)
    .values({
      ownerId,
      name: body.name,
      phoneNumber: body.phoneNumber ?? null,
      displayNumber: body.phoneNumber ? maskPhoneNumber(body.phoneNumber) : null,
      status: "disconnected",
    })
    .returning();

  await recordActivity({
    ownerId,
    sessionId: session.id,
    sessionName: session.name,
    type: "session_created",
    title: `${session.name} created`,
    detail: "Ready to connect a linked WhatsApp device.",
  });

  res.status(201).json(toSessionResponse(session));
});

router.get("/sessions/:sessionId", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { sessionId } = GetSessionParams.parse(req.params);
  const session = await getOwnedSession(ownerId, sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(toSessionResponse(session));
});

router.delete("/sessions/:sessionId", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { sessionId } = DeleteSessionParams.parse(req.params);
  const session = await getOwnedSession(ownerId, sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await whatsappSessionManager.logout(ownerId, sessionId);
  await db
    .delete(whatsappSessionsTable)
    .where(
      and(
        eq(whatsappSessionsTable.ownerId, ownerId),
        eq(whatsappSessionsTable.id, sessionId),
      ),
    );

  res.status(204).send();
});

router.post("/sessions/:sessionId/pairing-code", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { sessionId } = RequestPairingCodeParams.parse(req.params);
  const body = RequestPairingCodeBody.parse(req.body);
  const session = await getOwnedSession(ownerId, sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const updated = await setSessionStatus(ownerId, sessionId, "connecting");
  try {
    const code = await whatsappSessionManager.requestPairingCode(
      ownerId,
      sessionId,
      body.phoneNumber,
      createConnectionUpdateHandler(ownerId, sessionId),
    );
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (updated?.phoneNumber !== body.phoneNumber) {
      await db
        .update(whatsappSessionsTable)
        .set({
          phoneNumber: body.phoneNumber,
          displayNumber: maskPhoneNumber(body.phoneNumber),
        })
        .where(eq(whatsappSessionsTable.id, sessionId));
    }

    res.json({
      sessionId,
      code,
      expiresAt: expiresAt.toISOString(),
      status: "connecting",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Pairing code request failed";
    await setSessionStatus(ownerId, sessionId, "error", message);
    await recordActivity({
      ownerId,
      sessionId,
      sessionName: session.name,
      type: "session_error",
      title: `${session.name} needs attention`,
      detail: message,
    });
    res.status(409).json({ error: message });
  }
});

router.post("/sessions/:sessionId/connect", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { sessionId } = ConnectSessionParams.parse(req.params);
  const session = await getOwnedSession(ownerId, sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await whatsappSessionManager.start(
    ownerId,
    sessionId,
    createConnectionUpdateHandler(ownerId, sessionId),
  );
  const updated = await setSessionStatus(ownerId, sessionId, "connecting");
  res.json(toSessionResponse(updated ?? session));
});

router.post("/sessions/:sessionId/disconnect", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { sessionId } = DisconnectSessionParams.parse(req.params);
  const session = await getOwnedSession(ownerId, sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await whatsappSessionManager.stop(ownerId, sessionId);
  const updated = await setSessionStatus(ownerId, sessionId, "disconnected");
  await recordActivity({
    ownerId,
    sessionId,
    sessionName: session.name,
    type: "session_disconnected",
    title: `${session.name} stopped`,
    detail: "The worker was stopped without deleting device credentials.",
  });
  res.json(toSessionResponse(updated ?? session));
});

router.post("/sessions/:sessionId/logout", requireAuth, async (req, res) => {
  const ownerId = getTenantId(res);
  const { sessionId } = LogoutSessionParams.parse(req.params);
  const session = await getOwnedSession(ownerId, sessionId);

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await whatsappSessionManager.logout(ownerId, sessionId);
  const updated = await setSessionStatus(ownerId, sessionId, "logged_out");
  await recordActivity({
    ownerId,
    sessionId,
    sessionName: session.name,
    type: "session_logged_out",
    title: `${session.name} logged out`,
    detail: "The linked device credentials were cleared.",
  });
  res.json(toSessionResponse(updated ?? session));
});

export default router;