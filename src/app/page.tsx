"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
    router.refresh();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" />
  );
}
