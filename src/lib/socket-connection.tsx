"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/lib/socket-client";

type SocketConnectionContextValue = {
  socket: Socket;
  isConnected: boolean;
  connectionError: string | null;
};

const SocketConnectionContext = createContext<SocketConnectionContextValue | null>(null);

export function SocketConnectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const socket = useMemo(() => getSocket(), []);

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (error: unknown) => {
      setIsConnected(false);
      if (error instanceof Error) {
        setConnectionError(error.message);
      } else {
        setConnectionError("Failed to connect");
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [socket]);

  const value = useMemo(
    () => ({ socket, isConnected, connectionError }),
    [socket, isConnected, connectionError]
  );

  return (
    <SocketConnectionContext.Provider value={value}>
      {children}
    </SocketConnectionContext.Provider>
  );
}

export function useSocketConnection() {
  const ctx = useContext(SocketConnectionContext);
  if (!ctx) {
    throw new Error("useSocketConnection must be used within SocketConnectionProvider");
  }
  return ctx;
}
