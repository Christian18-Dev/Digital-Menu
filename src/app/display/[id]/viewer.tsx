/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useRef } from "react";
import { getSocket } from "@/lib/socket-client";
import type { DisplayWithMenu } from "@/lib/types";

type Props = { displayId: string };

const IMAGE_CHANGE_INTERVAL_MS = 10000; // 10 seconds per image

// Calculate which image should be shown based on current time
// This ensures all screens stay synchronized by using a fixed reference point
function calculateImageIndex(imageUrls: string[]): number {
  if (imageUrls.length <= 1) return 0;
  
  // Use current time modulo cycle duration to ensure all screens sync
  // This works because all screens calculate from the same current time
  const cycleDuration = imageUrls.length * IMAGE_CHANGE_INTERVAL_MS;
  const currentTime = Date.now();
  // Use a fixed epoch (midnight Jan 1, 2024) as reference for consistent cycling
  // This ensures all screens calculate the same position in the cycle
  const FIXED_EPOCH = new Date('2024-01-01T00:00:00Z').getTime();
  const elapsed = currentTime - FIXED_EPOCH;
  const cyclePosition = elapsed % cycleDuration;
  return Math.floor(cyclePosition / IMAGE_CHANGE_INTERVAL_MS);
}

export default function DisplayClient({ displayId }: Props) {
  const [payload, setPayload] = useState<DisplayWithMenu | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    hasLoadedRef.current = false;
    
    const fetchInitial = async () => {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/displays/${displayId}`);
        if (!res.ok) {
          if (mounted) {
            setNotFound(true);
            setIsLoading(false);
          }
          return;
        }
        const data = await res.json();
        if (mounted) {
          setPayload(data.display);
          setIsLoading(false);
          hasLoadedRef.current = true;
        }
      } catch (error) {
        if (mounted) {
          setNotFound(true);
          setIsLoading(false);
        }
      }
    };
    fetchInitial();

    const socket = getSocket();
    socket.emit("subscribeDisplay", displayId);
    const heartbeat = setInterval(
      () => socket.emit("displayHeartbeat", displayId),
      15000
    );
    socket.on("displayUpdate", (data: DisplayWithMenu) => {
      if (mounted) {
        setPayload(data);
        setNotFound(false);
        hasLoadedRef.current = true;
      }
    });
    socket.on("displayNotFound", () => {
      // Only set not found if we haven't successfully loaded data
      if (mounted && !hasLoadedRef.current) {
        setNotFound(true);
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
      socket.off("displayUpdate");
      socket.off("displayNotFound");
      socket.disconnect();
      clearInterval(heartbeat);
    };
  }, [displayId]);

  // Update image index based on time to keep all screens synchronized
  useEffect(() => {
    if (!payload?.menu?.imageUrls || payload.menu.imageUrls.length <= 1) {
      setCurrentImageIndex(0);
      return;
    }

    // Calculate initial index based on current time
    // All screens will calculate the same index because they use the same time reference
    const initialIndex = calculateImageIndex(payload.menu.imageUrls);
    setCurrentImageIndex(initialIndex);

    // Update every second to keep in sync (more frequent updates ensure smooth transitions)
    const interval = setInterval(() => {
      const newIndex = calculateImageIndex(payload.menu!.imageUrls!);
      setCurrentImageIndex(newIndex);
    }, 1000);

    return () => clearInterval(interval);
  }, [payload?.menu?.imageUrls]);

  if (isLoading) {
    return (
      <FullScreenShell>
        <p className="text-xl font-semibold">Loading...</p>
      </FullScreenShell>
    );
  }

  if (notFound) {
    return (
      <FullScreenShell>
        <p className="text-xl font-semibold">Display not found</p>
        <p className="text-sm text-slate-400">
          Check the link or create the display in the admin dashboard.
        </p>
      </FullScreenShell>
    );
  }

  if (!payload?.menu) {
    return (
      <FullScreenShell>
        <p className="text-xl font-semibold">No menu assigned</p>
        <p className="text-sm text-slate-400">
          Waiting for an admin to push a menu…
        </p>
      </FullScreenShell>
    );
  }

  const { menu, name } = payload;

  if (!menu.imageUrls || menu.imageUrls.length === 0) {
    return (
      <FullScreenShell>
        <p className="text-xl font-semibold">No menu images</p>
        <p className="text-sm text-slate-400">
          Menu images are missing or not uploaded.
        </p>
      </FullScreenShell>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-900 text-white">
      <div className="relative h-screen w-screen overflow-hidden bg-black">
        {menu.imageUrls.map((url, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              idx === currentImageIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={url}
              alt={`${menu.name} ${idx + 1}`}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 bg-black/10" />
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 rounded-md bg-black/70 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
        Live sync • {new Date(menu.updatedAt).toLocaleTimeString()}
        <span className="ml-2 text-[10px] font-normal text-slate-300">
          {name}
        </span>
        {menu.imageUrls.length > 1 && (
          <span className="ml-2 text-[10px] font-normal text-slate-300">
            • {currentImageIndex + 1}/{menu.imageUrls.length}
          </span>
        )}
      </div>
    </div>
  );
}

function FullScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-900 text-center text-white">
      {children}
    </div>
  );
}


