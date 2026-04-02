import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Insightful — Share Your Claude Code Insights",
  description:
    "A community platform for sharing Claude Code /insights reports. Discover tips, workflows, and learn from how others use Claude Code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 dark:border-slate-800">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Insightful — Share your Claude Code insights with the community
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Built with Claude Code
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
