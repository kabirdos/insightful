"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Users, Plus, Crown } from "lucide-react";

interface MyGroup {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  role: string;
}

export function GroupsEmptyState() {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
      Create a group and invite people to share your reports privately.
    </p>
  );
}

function CreateGroupForm({ onCreated }: { onCreated: (slug: string) => void }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to create group");
      }
      onCreated(json.group.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        Create a group
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          maxLength={60}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}

export default function GroupsIndexPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch once auth has resolved to authenticated. We never flip
    // `loading` synchronously here (that would trip
    // react-hooks/set-state-in-effect); the render guards below derive
    // the spinner from sessionStatus + loading instead.
    if (sessionStatus !== "authenticated") return;
    let cancelled = false;
    fetch("/api/groups")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setGroups(json.groups ?? []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStatus]);

  // Auth still resolving — show the spinner before deciding which view.
  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Groups
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Sign in to create groups and share your reports privately.
        </p>
        <button
          type="button"
          onClick={() => signIn("github", { callbackUrl: "/groups" })}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Sign in with GitHub
        </button>
      </div>
    );
  }

  // Authenticated but the groups fetch is still in flight.
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
        My Groups
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Private groups you belong to. Share reports inside a group instead of
        publishing publicly.
      </p>

      <div className="mb-8">
        <CreateGroupForm
          onCreated={(slug) => router.push(`/g/${encodeURIComponent(slug)}`)}
        />
      </div>

      {groups.length === 0 ? (
        <GroupsEmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/g/${encodeURIComponent(g.slug)}`}
              className="group rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="flex items-center gap-1.5">
                <h2 className="truncate font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                  {g.name}
                </h2>
                {g.role === "owner" && (
                  <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                )}
              </div>
              {g.description && (
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                  {g.description}
                </p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="h-3.5 w-3.5" />
                {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
