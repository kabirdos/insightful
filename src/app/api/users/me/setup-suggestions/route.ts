// GET /api/users/me/setup-suggestions
//
// Returns profile-setup field suggestions derived from the signed-in user's
// most recent insight-harness report. The derive helper operates on
// stripHiddenHarnessData output, so a user who has hidden (e.g.) mcpServers
// on their report will not get mcpServers suggestions — honoring the
// existing privacy model.
//
// primaryAgent is added here (not in derive) as the endpoint's static
// default: every insight-harness report implies Claude Code as the primary
// agent. Keeping it out of derive means an empty/stripped report can honestly
// return { status: "no-suggestions" }.
//
// See docs/plans/2026-04-13-profile-setup-fields.md §7.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { normalizeHarnessData } from "@/types/insights";
import { stripHiddenHarnessData } from "@/lib/harness-section-visibility";
import { deriveSetupFromHarness } from "@/lib/profile-setup-derive";
import type { DerivedSetupFields } from "@/types/profile";

type SuggestionsResponse =
  | {
      status: "ok";
      suggestions: DerivedSetupFields;
      sourceReportId: string;
      sourceReportCreatedAt: string;
    }
  | { status: "no-reports" }
  | { status: "no-suggestions" };

export async function GET(): Promise<
  NextResponse<SuggestionsResponse | { error: string }>
> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const report = await prisma.insightReport.findFirst({
      where: { authorId: session.user.id, reportType: "insight-harness" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        harnessData: true,
        hiddenHarnessSections: true,
      },
    });

    if (!report) {
      return NextResponse.json({ status: "no-reports" });
    }

    const harness = normalizeHarnessData(report.harnessData);
    if (!harness) {
      // Report exists but its harnessData is malformed / legacy — treat as
      // no-suggestions rather than error. This path is rare but defensible.
      return NextResponse.json({ status: "no-suggestions" });
    }

    const filtered = stripHiddenHarnessData(
      harness,
      report.hiddenHarnessSections ?? [],
    );
    const derived = deriveSetupFromHarness(filtered);

    const hasData = Object.keys(derived).length > 0;
    if (!hasData) {
      return NextResponse.json({ status: "no-suggestions" });
    }

    // Report exists AND has signal: primaryAgent is safe to suggest alongside
    // derived fields. The UI suppresses any suggestion whose field is
    // already filled by the user.
    const suggestions: DerivedSetupFields = {
      primaryAgent: "Claude Code",
      ...derived,
    };

    return NextResponse.json({
      status: "ok",
      suggestions,
      sourceReportId: report.id,
      sourceReportCreatedAt: report.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("GET /api/users/me/setup-suggestions error:", error);
    return NextResponse.json(
      { error: "Failed to compute suggestions" },
      { status: 500 },
    );
  }
}
