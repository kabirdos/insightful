"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useSession, signIn } from "next-auth/react";
import { Users, UserPlus, Trash2, Crown } from "lucide-react";
import clsx from "clsx";
import { buildReportUrl } from "@/lib/urls";
import {
  formatCompactNumber,
  formatInteger,
  perWeek,
} from "@/lib/number-format";
import CopyCommand from "@/components/CopyCommand";

// ── API response shapes (authoritative: GET /api/groups/[slug]) ──────
export interface LatestReport {
  slug: string;
  title: string;
  reportType: string;
  totalTokens: number | null;
  sessionCount: number | null;
  commitCount: number | null;
  durationHours: number | null;
  avgSessionMinutes: number | null;
  prCount: number | null;
  autonomyLabel: string | null;
  detectedSkills: string[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  publishedAt: string | null;
}

export interface GroupMember {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
  latestReport: LatestReport | null;
}

interface GroupDetail {
  group: {
    slug: string;
    name: string;
    description: string | null;
    createdAt: string;
    memberCount: number;
  };
  viewerRole: string;
  members: GroupMember[];
}

interface ActiveInvite {
  id: string;
  token: string;
  url: string;
  expiresAt: string | null;
  usedCount: number;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────
// The group API hands us a date RANGE (dateRangeStart/dateRangeEnd) but
// not the dayCount the homepage card reads directly. Derive an inclusive
// day span so we can run the same perWeek math. Returns null when the
// range can't be resolved, so the no-silent-zero rule still holds.
function dayCountFromRange(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null;
  const days = Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1;
  return days > 0 ? days : null;
}

function formatHours(n: number): string {
  if (n >= 100) return `${Math.round(n)}h`;
  if (n >= 10) return `${n.toFixed(0)}h`;
  return `${n.toFixed(1)}h`;
}

function Avatar({
  displayName,
  username,
  avatarUrl,
  size = 40,
}: {
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full"
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}
    >
      {(displayName || username)[0]?.toUpperCase()}
    </div>
  );
}

// ── Member comparison card ───────────────────────────────────────────
// Vanity stats FIRST and BIG. Every per-week stat is omitted (never 0/—)
// when its source metric is missing — honoring the no-silent-zero rule.
// Exported for unit tests (renderToStaticMarkup smoke checks).
export function MemberCard({ member }: { member: GroupMember }) {
  const r = member.latestReport;
  const identityName = member.displayName || member.username;

  if (!r) {
    return (
      <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 opacity-80 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Avatar
            displayName={member.displayName}
            username={member.username}
            avatarUrl={member.avatarUrl}
            size={40}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-semibold text-slate-900 dark:text-white">
              {identityName}
              {member.role === "owner" && (
                <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              )}
            </div>
            <div className="truncate text-xs text-slate-400">
              @{member.username}
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
          No shared report yet
        </p>
      </div>
    );
  }

  const dayCount = dayCountFromRange(r.dateRangeStart, r.dateRangeEnd);
  const sessionsWk = perWeek(r.sessionCount, dayCount);
  const hoursWk = perWeek(r.durationHours, dayCount);
  const commitsWk = perWeek(r.commitCount, dayCount);
  const lifetimeTokens = r.totalTokens;
  const skills = r.detectedSkills.slice(0, 3);

  // Build the per-week stat strip, omitting any sourceless metric.
  const stats: { label: string; value: string; color: string }[] = [];
  if (sessionsWk != null) {
    stats.push({
      label: "sessions / wk",
      value: Math.round(sessionsWk).toLocaleString(),
      color: "text-green-600 dark:text-green-400",
    });
  }
  if (hoursWk != null && hoursWk > 0) {
    stats.push({
      label: "active / wk",
      value: formatHours(hoursWk),
      color: "text-cyan-600 dark:text-cyan-400",
    });
  }
  if (commitsWk != null && commitsWk > 0) {
    stats.push({
      label: "commits / wk",
      value: Math.round(commitsWk).toLocaleString(),
      color: "text-violet-600 dark:text-violet-400",
    });
  }
  if (r.prCount != null && r.prCount > 0) {
    stats.push({
      label: "PRs",
      value: formatInteger(r.prCount),
      color: "text-slate-800 dark:text-slate-200",
    });
  }

  return (
    <Link
      href={buildReportUrl(member.username, r.slug)}
      className="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      {/* Hero: lifetime tokens BIG */}
      {lifetimeTokens != null && lifetimeTokens > 0 && (
        <div className="mb-3">
          <div className="font-mono text-3xl font-bold leading-none text-blue-600 dark:text-blue-400">
            {formatCompactNumber(lifetimeTokens)}
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
            lifetime tokens
          </div>
        </div>
      )}

      {/* Identity */}
      <div className="flex items-center gap-3">
        <Avatar
          displayName={member.displayName}
          username={member.username}
          avatarUrl={member.avatarUrl}
          size={38}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
            {identityName}
            {member.role === "owner" && (
              <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
          </div>
          <div className="truncate text-xs text-slate-400">
            @{member.username}
          </div>
        </div>
      </div>

      {/* Per-week stat strip */}
      {stats.length > 0 && (
        <div className="my-4 flex flex-wrap items-stretch border-y border-slate-100 py-2.5 font-mono dark:border-slate-800">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={clsx(
                "flex flex-1 flex-col px-3 first:pl-0 last:pr-0",
                i < stats.length - 1 &&
                  "border-r border-slate-100 dark:border-slate-800",
              )}
            >
              <span
                className={clsx("text-[15px] font-bold leading-none", s.color)}
              >
                {s.value}
              </span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Autonomy pill + skills */}
      {r.autonomyLabel && (
        <div className="mb-2">
          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {r.autonomyLabel}
          </span>
        </div>
      )}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            >
              {skill.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
        View report ↗
      </div>
    </Link>
  );
}

// ── Compact leaderboard table ────────────────────────────────────────
function GroupLeaderboard({
  members,
  viewerUsername,
}: {
  members: GroupMember[];
  viewerUsername: string | null;
}) {
  const rows = members
    .filter((m) => m.latestReport)
    .map((m) => {
      const r = m.latestReport!;
      return {
        username: m.username,
        displayName: m.displayName || m.username,
        reportSlug: r.slug,
        tokens: r.totalTokens ?? 0,
        sessions: r.sessionCount,
        commits: r.commitCount,
      };
    })
    .sort((a, b) => b.tokens - a.tokens);

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/60">
            <th className="px-4 py-2.5">#</th>
            <th className="px-4 py-2.5">Member</th>
            <th className="px-4 py-2.5 text-right">Lifetime tokens</th>
            <th className="px-4 py-2.5 text-right">Sessions</th>
            <th className="px-4 py-2.5 text-right">Commits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isViewer =
              viewerUsername != null && row.username === viewerUsername;
            return (
              <tr
                key={row.username}
                className={clsx(
                  "border-b border-slate-100 last:border-0 dark:border-slate-800",
                  isViewer
                    ? "bg-blue-50 dark:bg-blue-950/30"
                    : "bg-white dark:bg-slate-900",
                )}
              >
                <td className="px-4 py-2.5 font-mono text-slate-400">
                  {i + 1}
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    href={buildReportUrl(row.username, row.reportSlug)}
                    className="font-medium text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                  >
                    {row.displayName}
                  </Link>
                  <span className="ml-1.5 text-xs text-slate-400">
                    @{row.username}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                  {formatCompactNumber(row.tokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                  {row.sessions != null ? formatInteger(row.sessions) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                  {row.commits != null ? formatInteger(row.commits) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Owner invite panel ───────────────────────────────────────────────
function InvitePanel({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<ActiveInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/groups/${encodeURIComponent(slug)}/invites`,
      );
      if (!res.ok) throw new Error("Failed to load invites");
      const json = await res.json();
      setInvites(json.invites ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadInvites();
  };

  const createInvite = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/groups/${encodeURIComponent(slug)}/invites`,
        { method: "POST" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to create invite");
      }
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const revokeInvite = async (id: string) => {
    setError(null);
    // Optimistic removal.
    const prev = invites;
    setInvites((cur) => cur.filter((inv) => inv.id !== id));
    try {
      const res = await fetch(
        `/api/groups/${encodeURIComponent(slug)}/invites/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to revoke invite");
    } catch (err) {
      setInvites(prev);
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        <UserPlus className="h-4 w-4" />
        Invite
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[22rem] max-w-[90vw] rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Invite links
            </h3>
            <button
              type="button"
              onClick={createInvite}
              disabled={creating}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating…" : "New link"}
            </button>
          </div>

          {error && (
            <p className="mb-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No active invites. Create a link to share.
            </p>
          ) : (
            <ul className="space-y-2">
              {invites.map((inv) => (
                <li key={inv.id} className="space-y-1">
                  <CopyCommand command={inv.url} label="Copy link" />
                  <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                    <span>
                      {inv.usedCount} use{inv.usedCount === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => revokeInvite(inv.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:underline dark:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" /> Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Invite-only card (non-member / anonymous) ────────────────────────
export function InviteOnlyCard({
  slug,
  signedIn,
}: {
  slug: string;
  signedIn: boolean;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
        <Users className="h-6 w-6 text-slate-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        {slug}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        This group is invite-only. Ask a member for an invite link.
      </p>
      {!signedIn && (
        <button
          type="button"
          onClick={() => signIn("github")}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Sign in with GitHub
        </button>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
export default function GroupPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session, status: sessionStatus } = useSession();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `loading` starts true on mount; the effect only runs once for a
    // stable slug, so we never need to re-flip it synchronously here
    // (which would trip react-hooks/set-state-in-effect).
    let cancelled = false;
    fetch(`/api/groups/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const json = await res.json();
        if (json.error) {
          setNotFound(true);
        } else {
          setDetail(json as GroupDetail);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const learnCommand = useMemo(
    () => `Learn from this group: https://insightharness.com/g/${slug}`,
    [slug],
  );

  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !detail) {
    return <InviteOnlyCard slug={slug} signedIn={!!session?.user} />;
  }

  const { group, viewerRole, members } = detail;
  const viewerUsername = session?.user?.username ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {group.name}
          </h1>
          {group.description && (
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {group.description}
            </p>
          )}
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-400">
            <Users className="h-4 w-4" />
            {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
          </div>
        </div>
        {viewerRole === "owner" && <InvitePanel slug={slug} />}
      </div>

      {/* Comparison grid */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <MemberCard key={m.username} member={m} />
        ))}
      </div>

      {/* Leaderboard */}
      <div className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Leaderboard
        </h2>
        <GroupLeaderboard members={members} viewerUsername={viewerUsername} />
      </div>

      {/* Learn from this group */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Learn from this group
        </h2>
        <p className="mb-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
          Paste into Claude Code with the insight-harness skill installed — your
          agent fetches every member&apos;s setup and tells you what to copy.
        </p>
        <CopyCommand command={learnCommand} label="Copy" />
      </div>
    </div>
  );
}
