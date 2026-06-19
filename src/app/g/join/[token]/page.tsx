"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { Users, GitFork } from "lucide-react";

interface InvitePreview {
  valid: boolean;
  group?: { name: string; memberCount: number };
}

// Invalid / expired / revoked invite view. Exported for unit tests
// (renderToStaticMarkup smoke check of the invalid state).
export function InviteUnavailable() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        Invite unavailable
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        This invite is no longer valid.
      </p>
    </div>
  );
}

export default function JoinGroupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);

  // Where GitHub OAuth should land the signed-out visitor back: this
  // very page, so the join flow resumes after the round-trip.
  const callbackUrl =
    typeof window !== "undefined" ? window.location.pathname : undefined;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/groups/join?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((json: InvitePreview) => {
        if (!cancelled) setPreview(json);
      })
      .catch(() => {
        if (!cancelled) setPreview({ valid: false });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to join group");
      }
      if (json.alreadyMember) {
        setAlreadyMember(true);
      }
      router.push(`/g/${encodeURIComponent(json.group.slug)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join group");
      setJoining(false);
    }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!preview?.valid || !preview.group) {
    return <InviteUnavailable />;
  }

  const { name, memberCount } = preview.group;

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
        <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
      </div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        You&apos;ve been invited to join {name}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {memberCount} member{memberCount === 1 ? "" : "s"}
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {alreadyMember && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          You&apos;re already a member — taking you to the group…
        </p>
      )}

      <div className="mt-6">
        {session?.user ? (
          <button
            type="button"
            onClick={join}
            disabled={joining}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {joining ? "Joining…" : `Join ${name}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signIn("github", { callbackUrl })}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <GitFork className="h-4 w-4" />
            Sign in with GitHub to join
          </button>
        )}
      </div>
    </div>
  );
}
