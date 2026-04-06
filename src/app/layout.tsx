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
  title: "Insight Harness — See How Developers Use Claude Code",
  description:
    "Browse real developer workflows — the tools, skills, plugins, and patterns they use across actual coding sessions. Upload your /insights report and share your profile.",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full overflow-x-hidden`}
    >
      <body className="min-h-full flex flex-col font-sans antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-x-hidden">
        <Providers>
          <Header />
          <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
          <footer className="border-t border-slate-200 dark:border-slate-800">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Insight Harness — See how developers use Claude Code
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
