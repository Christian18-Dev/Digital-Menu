"use client";

import { useSocketConnection } from "@/lib/socket-connection";

export default function ConnectionBadge() {
  const { isConnected } = useSocketConnection();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
      <span
        className={
          "inline-flex h-2 w-2 rounded-full " +
          (isConnected ? "bg-emerald-500" : "bg-slate-300")
        }
      />
      <span>{isConnected ? "Connected" : "Disconnected"}</span>
    </div>
  );
}
