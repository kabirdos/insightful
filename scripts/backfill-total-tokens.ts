/**
 * One-time backfill for the totalTokens switch from
 * "input + output" (Option A) to "input + output + cache_read +
 * cache_creation" (Option B / full throughput). See insight-harness#7.
 *
 * Reports uploaded before the skill v2.7.0 update carry the old (low)
 * totalTokens value. For any report that still has its 4-way per-model
 * breakdown in harnessData.perModelTokens, we can rebuild the correct
 * number server-side. Reports without that field (pre-v2.4 uploads,
 * demo seeds) are left untouched — we have no way to reconstruct the
 * missing cache counts.
 *
 * Run:
 *   npx tsx scripts/backfill-total-tokens.ts            # dry run
 *   npx tsx scripts/backfill-total-tokens.ts --apply    # write changes
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ModelBreakdown {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_create?: number;
}

function sumThroughput(perModelTokens: Record<string, ModelBreakdown>): number {
  let total = 0;
  for (const breakdown of Object.values(perModelTokens)) {
    total +=
      (breakdown.input ?? 0) +
      (breakdown.output ?? 0) +
      (breakdown.cache_read ?? 0) +
      (breakdown.cache_create ?? 0);
  }
  return total;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const reports = await prisma.insightReport.findMany({
    select: {
      id: true,
      slug: true,
      totalTokens: true,
      harnessData: true,
      author: { select: { username: true } },
    },
  });

  let candidates = 0;
  let skipped = 0;
  let hiddenSkipped = 0;
  let unchanged = 0;
  const rows: Array<{
    id: string;
    slug: string;
    username: string;
    old: number;
    next: number;
    ratio: string;
  }> = [];

  for (const report of reports) {
    const hd = report.harnessData as {
      perModelTokens?: Record<string, ModelBreakdown> | null;
      stats?: { totalTokens?: number } | null;
    } | null;
    const perModel = hd?.perModelTokens;
    if (!perModel || typeof perModel !== "object") {
      skipped++;
      continue;
    }
    // `totalTokens` is on the PUT allowlist and the schema marks it
    // nullable — the convention for "author hid this stat" is null, not
    // zero. Writing a fresh value would unhide data the author
    // intentionally redacted, so skip those rows entirely.
    if (report.totalTokens === null) {
      hiddenSkipped++;
      continue;
    }
    const next = sumThroughput(perModel);
    const old = report.totalTokens;
    if (next <= 0 || next === old) {
      unchanged++;
      continue;
    }
    candidates++;
    rows.push({
      id: report.id,
      slug: report.slug,
      username: report.author.username,
      old,
      next,
      ratio: old > 0 ? (next / old).toFixed(1) + "x" : "n/a",
    });
  }

  console.log(`\nScanned ${reports.length} reports`);
  console.log(
    `  ${candidates} need updating · ${unchanged} already match · ${skipped} lack perModelTokens (skipped) · ${hiddenSkipped} author-hidden (skipped)`,
  );

  if (candidates === 0) {
    console.log("\nNothing to do.");
    await prisma.$disconnect();
    return;
  }

  console.log("\nPreview (up to 20):");
  for (const r of rows.slice(0, 20)) {
    console.log(
      `  @${r.username} / ${r.slug}  ${r.old.toLocaleString()} → ${r.next.toLocaleString()}  (${r.ratio})`,
    );
  }
  if (rows.length > 20) {
    console.log(`  …and ${rows.length - 20} more`);
  }

  if (!apply) {
    console.log(
      "\nDry run — no changes written. Re-run with --apply to persist.",
    );
    await prisma.$disconnect();
    return;
  }

  console.log("\nApplying updates…");
  let written = 0;
  for (const r of rows) {
    const existing = await prisma.insightReport.findUnique({
      where: { id: r.id },
      select: { harnessData: true },
    });
    if (!existing?.harnessData) continue;
    const hd = existing.harnessData as Record<string, unknown>;
    const stats = (hd.stats as Record<string, unknown> | undefined) ?? {};
    const nextHarnessData = {
      ...hd,
      stats: { ...stats, totalTokens: r.next },
    };
    await prisma.insightReport.update({
      where: { id: r.id },
      data: {
        totalTokens: r.next,
        harnessData: nextHarnessData,
      },
    });
    written++;
  }
  console.log(`  ✓ Updated ${written} reports`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
