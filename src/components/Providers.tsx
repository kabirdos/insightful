"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import PostHogProvider from "./PostHogProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PostHogProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </PostHogProvider>
    </SessionProvider>
  );
}
