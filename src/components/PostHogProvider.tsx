"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
  });
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const url =
      window.origin +
      pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

function IdentifyUser() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const username = (session?.user as { username?: string } | undefined)
    ?.username;
  const wasIdentified = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (userId) {
      posthog.identify(userId, username ? { username } : undefined);
      wasIdentified.current = true;
    } else if (status === "unauthenticated" && wasIdentified.current) {
      posthog.reset();
      wasIdentified.current = false;
    }
  }, [userId, username, status]);

  return null;
}

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentifyUser />
      {children}
    </PHProvider>
  );
}
