import type { Metadata } from "next";
import { prisma } from "@/lib/db";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const report = await prisma.insightReport.findFirst({
    where: { slug },
    select: {
      totalTokens: true,
      sessionCount: true,
      commitCount: true,
      reportType: true,
      author: {
        select: {
          displayName: true,
          username: true,
        },
      },
    },
  });

  if (!report) return {};

  const name = report.author.displayName || report.author.username;
  const isHarness = report.reportType === "insight-harness";

  const title = isHarness
    ? `${name}'s Claude Code Harness`
    : `${name}'s Claude Code Profile`;

  const parts: string[] = [];
  if (report.totalTokens) {
    parts.push(`${formatTokens(report.totalTokens)} tokens`);
  }
  if (report.sessionCount) {
    parts.push(`${report.sessionCount} sessions`);
  }
  if (report.commitCount) {
    parts.push(`${report.commitCount} commits`);
  }
  const description =
    parts.length > 0
      ? parts.join(" \u00b7 ")
      : "See how this developer uses Claude Code";

  const ogImage = `/api/og/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: "profile",
      siteName: "InsightHarness",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function InsightSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
