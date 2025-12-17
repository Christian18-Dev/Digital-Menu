import type { NextApiRequest, NextApiResponse } from "next";
import { Server } from "socket.io";
import {
  getDisplayWithMenu,
  listDisplays,
  listMenus,
  subscribeToStore,
  setDisplayOffline,
  setDisplayOnline,
  heartbeatDisplay,
} from "@/lib/store";

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: {
      io?: Server;
    };
  };
};

const handler = (_req: NextApiRequest, res: NextApiResponseWithSocket) => {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server as any, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });
    res.socket.server.io = io;

    const displayBySocket = new Map<string, string>();

    io.on("connection", (socket) => {
      let joinedDisplayId: string | null = null;

      socket.on("subscribeAdmin", () => {
        socket.join("admins");
        socket.emit("bootstrap", {
          menus: listMenus(),
          displays: listDisplays(),
        });
      });

      socket.on("subscribeDisplay", (displayId: string) => {
        const room = `display:${displayId}`;
        socket.join(room);
        displayBySocket.set(socket.id, displayId);
        joinedDisplayId = displayId;
        setDisplayOnline(displayId);
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

    subscribeToStore((event) => {
      if (!res.socket.server.io) return;
      switch (event.type) {
        case "menus-changed": {
          res.socket.server.io.to("admins").emit("menusUpdated", listMenus());
          break;
        }
        case "displays-changed": {
          res.socket.server.io
            .to("admins")
            .emit("displaysUpdated", listDisplays());
          break;
        }
        case "display-menu-changed": {
          const payload = getDisplayWithMenu(event.displayId);
          if (payload) {
            res.socket.server.io
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

