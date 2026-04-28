import type { NextApiRequest, NextApiResponse } from "next";
import { Server } from "socket.io";
import {
  getDisplayWithMenu,
  hydrateDisplays,
  hydrateMenus,
  listDisplays,
  listMenus,
  subscribeToStore,
  setDisplayOffline,
  setDisplayOnline,
  heartbeatDisplay,
} from "@/lib/store";
import { getMongoDb } from "@/lib/mongodb";

let ioRef: Server | undefined;
let unsubscribeRef: (() => void) | undefined;
let offlineSweepIntervalRef: NodeJS.Timeout | undefined;

const DISPLAY_OFFLINE_AFTER_MS = 45000;
const OFFLINE_SWEEP_INTERVAL_MS = 10000;

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: {
      io?: Server;
    };
  };
};

const handler = (_req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!ioRef) {
    const io = new Server(res.socket.server as any, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });
    ioRef = io;
    res.socket.server.io = io;

    offlineSweepIntervalRef = setInterval(async () => {
      const activeIo = ioRef;
      if (!activeIo) return;

      const now = Date.now();
      const cutoff = now - DISPLAY_OFFLINE_AFTER_MS;

      try {
        const db = await getMongoDb();
        const stale = await db
          .collection("displays")
          .find(
            {
              online: true,
              lastSeen: { $lt: cutoff },
            },
            { projection: { _id: 0, id: 1 } }
          )
          .toArray();

        if (stale.length === 0) return;

        const staleIds = stale
          .map((d: any) => (typeof d?.id === "string" ? d.id : null))
          .filter((id: string | null): id is string => !!id);

        if (staleIds.length === 0) return;

        await db.collection("displays").updateMany(
          { id: { $in: staleIds } },
          {
            $set: {
              online: false,
              updatedAt: now,
            },
          }
        );

        staleIds.forEach((id) => setDisplayOffline(id));
        activeIo.to("admins").emit("displaysUpdated", listDisplays());
      } catch {
        // ignore
      }
    }, OFFLINE_SWEEP_INTERVAL_MS);

    const displayBySocket = new Map<string, string>();

    io.on("connection", (socket) => {
      let joinedDisplayId: string | null = null;

      socket.on("subscribeAdmin", async () => {
        socket.join("admins");
        const db = await getMongoDb();
        const [menusFromDb, displaysFromDb] = await Promise.all([
          db
            .collection("menus")
            .find({}, { projection: { _id: 0 } })
            .sort({ updatedAt: -1 })
            .toArray(),
          db
            .collection("displays")
            .find({}, { projection: { _id: 0 } })
            .sort({ updatedAt: -1 })
            .toArray(),
        ]);
        hydrateMenus(menusFromDb as any);
        hydrateDisplays(displaysFromDb as any);
        socket.emit("bootstrap", {
          menus: listMenus(),
          displays: listDisplays(),
        });
      });

      socket.on("subscribeDisplay", async (displayId: string) => {
        const room = `display:${displayId}`;
        socket.join(room);
        displayBySocket.set(socket.id, displayId);
        joinedDisplayId = displayId;
        setDisplayOnline(displayId);

        try {
          const db = await getMongoDb();
          const now = Date.now();
          await db.collection("displays").updateOne(
            { id: displayId },
            {
              $set: {
                online: true,
                lastSeen: now,
                updatedAt: now,
              },
            },
            { upsert: false }
          );
        } catch {
          // ignore
        }

        const db = await getMongoDb();
        const [menusFromDb, displaysFromDb] = await Promise.all([
          db
            .collection("menus")
            .find({}, { projection: { _id: 0 } })
            .sort({ updatedAt: -1 })
            .toArray(),
          db
            .collection("displays")
            .find({}, { projection: { _id: 0 } })
            .sort({ updatedAt: -1 })
            .toArray(),
        ]);
        hydrateMenus(menusFromDb as any);
        hydrateDisplays(displaysFromDb as any);

        const payload = getDisplayWithMenu(displayId);
        if (payload) {
          socket.emit("displayUpdate", payload);
        } else {
          socket.emit("displayNotFound", displayId);
        }
      });

      socket.on("displayHeartbeat", async (displayId: string) => {
        heartbeatDisplay(displayId);
        try {
          const db = await getMongoDb();
          const now = Date.now();
          await db.collection("displays").updateOne(
            { id: displayId },
            {
              $set: {
                online: true,
                lastSeen: now,
              },
            },
            { upsert: false }
          );
        } catch {
          // ignore
        }
      });

      socket.on("disconnect", async () => {
        if (joinedDisplayId) {
          const displayId = joinedDisplayId;
          setDisplayOffline(displayId);
          displayBySocket.delete(socket.id);
          try {
            const db = await getMongoDb();
            const now = Date.now();
            await db.collection("displays").updateOne(
              { id: displayId },
              {
                $set: {
                  online: false,
                  updatedAt: now,
                },
              },
              { upsert: false }
            );
          } catch {
            // ignore
          }
        }
      });
    });

    unsubscribeRef?.();
    unsubscribeRef = subscribeToStore((event) => {
      const activeIo = ioRef;
      if (!activeIo) return;
      switch (event.type) {
        case "menus-changed": {
          activeIo.to("admins").emit("menusUpdated", listMenus());
          break;
        }
        case "displays-changed": {
          activeIo.to("admins").emit("displaysUpdated", listDisplays());
          break;
        }
        case "display-menu-changed": {
          const payload = getDisplayWithMenu(event.displayId);
          if (payload) {
            activeIo
              .to(`display:${event.displayId}`)
              .emit("displayUpdate", payload);
          }
          break;
        }
        default:
          break;
      }
    });
  }
  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;

