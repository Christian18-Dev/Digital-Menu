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

    const displayBySocket = new Map<string, string>();

    io.on("connection", (socket) => {
      let joinedDisplayId: string | null = null;

      socket.on("subscribeAdmin", async () => {
        socket.join("admins");
        const db = await getMongoDb();
        const [menusFromDb, displaysFromDb] = await Promise.all([
          db.collection("menus").find({}, { projection: { _id: 0 } }).toArray(),
          db
            .collection("displays")
            .find({}, { projection: { _id: 0 } })
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

        const db = await getMongoDb();
        const [menusFromDb, displaysFromDb] = await Promise.all([
          db.collection("menus").find({}, { projection: { _id: 0 } }).toArray(),
          db
            .collection("displays")
            .find({}, { projection: { _id: 0 } })
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

      socket.on("displayHeartbeat", (displayId: string) => {
        heartbeatDisplay(displayId);
      });

      socket.on("disconnect", () => {
        if (joinedDisplayId) {
          setDisplayOffline(joinedDisplayId);
          displayBySocket.delete(socket.id);
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

