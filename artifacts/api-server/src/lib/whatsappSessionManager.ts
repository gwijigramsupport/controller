import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import fs from "node:fs/promises";
import path from "node:path";
import pino from "pino";

const rootLogger = pino({ level: "silent" });
const connections = new Map<string, WASocket>();

function connectionKey(ownerId: string, sessionId: string): string {
  return `${ownerId}:${sessionId}`;
}

function authDirectory(ownerId: string, sessionId: string): string {
  const safeOwner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(
    process.env.WHATSAPP_AUTH_DIR ?? "data/whatsapp-auth",
    safeOwner,
    safeSession,
  );
}

export type SessionConnectionUpdate = {
  connection?: "connecting" | "open" | "close";
  lastDisconnect?: unknown;
  qr?: string;
};

export class WhatsAppSessionManager {
  async start(
    ownerId: string,
    sessionId: string,
    onUpdate: (update: SessionConnectionUpdate) => Promise<void>,
  ): Promise<WASocket> {
    const key = connectionKey(ownerId, sessionId);
    const current = connections.get(key);
    if (current) return current;

    const state = await useMultiFileAuthState(authDirectory(ownerId, sessionId));
    const socket = makeWASocket({
      auth: state.state,
      browser: Browsers.macOS("WhatsApp Session Cloud"),
      logger: rootLogger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    state.saveCreds().catch(() => undefined);
    socket.ev.on("creds.update", state.saveCreds);
    socket.ev.on("connection.update", (update) => {
      void onUpdate(update);

      if (update.connection === "close") {
        const errorCode = (update.lastDisconnect as {
          error?: { output?: { statusCode?: number } };
        })?.error?.output?.statusCode;
        if (errorCode === DisconnectReason.loggedOut) {
          connections.delete(key);
        }
      }
    });

    connections.set(key, socket);
    return socket;
  }

  get(ownerId: string, sessionId: string): WASocket | undefined {
    return connections.get(connectionKey(ownerId, sessionId));
  }

  async requestPairingCode(
    ownerId: string,
    sessionId: string,
    phoneNumber: string,
    onUpdate: (update: SessionConnectionUpdate) => Promise<void>,
  ): Promise<string> {
    const socket = await this.start(ownerId, sessionId, onUpdate);
    const normalizedNumber = phoneNumber.replace(/\D/g, "");

    if (!normalizedNumber) {
      throw new Error("A valid international phone number is required");
    }

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    return socket.requestPairingCode(normalizedNumber);
  }

  async stop(ownerId: string, sessionId: string): Promise<void> {
    const key = connectionKey(ownerId, sessionId);
    const socket = connections.get(key);
    if (!socket) return;

    socket.ws.close();
    connections.delete(key);
  }

  async logout(ownerId: string, sessionId: string): Promise<void> {
    const key = connectionKey(ownerId, sessionId);
    const socket = connections.get(key);
    if (socket) {
      await socket.logout();
      connections.delete(key);
    }

    await fs.rm(authDirectory(ownerId, sessionId), {
      recursive: true,
      force: true,
    });
  }
}

export const whatsappSessionManager = new WhatsAppSessionManager();