"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import {
  User,
  Heart,
  FileText,
  Calendar,
  Pencil,
  X,
  Check,
  Globe,
  Trash2,
} from "lucide-react";
import InsightCard from "@/components/InsightCard";
import SetupCard from "@/components/profile/SetupCard";
import { buildReportApiUrl, buildReportEditUrl } from "@/lib/urls";
import type { ProfileSetup } from "@/types/profile";
import {
  OS_SUGGESTIONS,
  EDITOR_SUGGESTIONS,
  TERMINAL_SUGGESTIONS,
  SHELL_SUGGESTIONS,
  PRIMARY_AGENT_SUGGESTIONS,
  PRIMARY_MODEL_SUGGESTIONS,
  PACKAGE_MANAGER_SUGGESTIONS,
} from "@/lib/profile-setup-suggestions";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

interface UserProfile {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  githubUrl?: string | null;
  twitterUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  setup?: ProfileSetup | null;
  createdAt: string;
  totalReports: number;
  totalVotes: number;
  reports: {
    slug: string;
    title: string;
    publishedAt: string;
    dateRangeStart?: string | null;
    dateRangeEnd?: string | null;
    sessionCount?: number | null;
    messageCount?: number | null;
    commitCount?: number | null;
    whatsWorkingPreview?: string | null;
    voteCount: number;
    commentCount: number;
    sectionTags: string[];
  }[];
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SocialLinks({
  profile,
}: {
  profile: Pick<
    UserProfile,
    "githubUrl" | "twitterUrl" | "linkedinUrl" | "websiteUrl"
  >;
}) {
  const links = [
    {
      url: profile.githubUrl,
      icon: GithubIcon,
      label: "GitHub",
    },
    {
      url: profile.twitterUrl,
      icon: XIcon,
      label: "X / Twitter",
    },
    {
      url: profile.linkedinUrl,
      icon: LinkedinIcon,
      label: "LinkedIn",
    },
    {
      url: profile.websiteUrl,
      icon: Globe,
      label: "Website",
    },
  ].filter((l) => l.url);

  if (links.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-3">
      {links.map(({ url, icon: Icon, label }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener noreferrer"
          className="text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
          title={label}
        >
          <Icon className="h-5 w-5" />
        </a>
      ))}
    </div>
  );
}

interface EditFormSetup {
  os: string;
  machine: string;
  keyboard: string;
  editor: string;
  terminal: string;
  shell: string;
  primaryAgent: string;
  primaryModel: string;
  /** Comma-separated string in the form; split into string[] on submit. */
  mcpServers: string;
  packageManager: string;
  dotfilesUrl: string;
}

interface EditFormData {
  displayName: string;
  bio: string;
  githubUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
  setup: EditFormSetup;
}

const EMPTY_SETUP_FORM: EditFormSetup = {
  os: "",
  machine: "",
  keyboard: "",
  editor: "",
  terminal: "",
  shell: "",
  primaryAgent: "",
  primaryModel: "",
  mcpServers: "",
  packageManager: "",
  dotfilesUrl: "",
};

function setupToForm(setup: ProfileSetup | null | undefined): EditFormSetup {
  if (!setup) return EMPTY_SETUP_FORM;
  return {
    os: setup.os ?? "",
    machine: setup.machine ?? "",
    keyboard: setup.keyboard ?? "",
    editor: setup.editor ?? "",
    terminal: setup.terminal ?? "",
    shell: setup.shell ?? "",
    primaryAgent: setup.primaryAgent ?? "",
    primaryModel: setup.primaryModel ?? "",
    mcpServers: setup.mcpServers?.join(", ") ?? "",
    packageManager: setup.packageManager ?? "",
    dotfilesUrl: setup.dotfilesUrl ?? "",
  };
}

/** Convert the flat form state into the payload the PUT endpoint expects. */
function formSetupToPayload(
  form: EditFormSetup,
): Record<string, string | string[]> {
  const payload: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(form)) {
    if (key === "mcpServers") continue;
    if (value && value.trim()) payload[key] = value.trim();
  }
  const mcpList = form.mcpServers
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (mcpList.length > 0) payload.mcpServers = mcpList;
  return payload;
}

function SetupGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SetupInput({
  label,
  value,
  onChange,
  listId,
  options,
  placeholder,
  inputClass,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  listId?: string;
  options?: readonly string[];
  placeholder?: string;
  inputClass: string;
  type?: "text" | "url";
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <input
        type={type}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      {listId && options ? (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}

function ProfileEditForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: UserProfile;
  onSave: (data: EditFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditFormData>({
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    githubUrl: profile.githubUrl ?? "",
    twitterUrl: profile.twitterUrl ?? "",
    linkedinUrl: profile.linkedinUrl ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    setup: setupToForm(profile.setup),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(() => {
    // Default-open when the user already has setup content — they're editing,
    // not exploring. Default-closed for empty-setup first-timers.
    return Boolean(profile.setup);
  });

  const updateSetup = (patch: Partial<EditFormSetup>) =>
    setForm((f) => ({ ...f, setup: { ...f.setup, ...patch } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Display Name
        </label>
        <input
          type="text"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="Your name"
          className={inputClass}
          maxLength={100}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Bio
        </label>
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Tell people about yourself..."
          className={inputClass}
          rows={3}
          maxLength={500}
        />
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Social Links
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <GithubIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="url"
              value={form.githubUrl}
              onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
              placeholder="https://github.com/username"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-2">
            <XIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="url"
              value={form.twitterUrl}
              onChange={(e) => setForm({ ...form, twitterUrl: e.target.value })}
              placeholder="https://x.com/username"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-2">
            <LinkedinIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="url"
              value={form.linkedinUrl}
              onChange={(e) =>
                setForm({ ...form, linkedinUrl: e.target.value })
              }
              placeholder="https://linkedin.com/in/username"
              className={inputClass}
            />
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://yoursite.com"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setSetupOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Developer Setup
          </h3>
          <span className="text-xs text-slate-400">
            {setupOpen ? "Hide" : "Show"}
          </span>
        </button>
        {setupOpen && (
          <div className="mt-3 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optional. All fields appear publicly on your profile — leave blank
              to hide.
            </p>

            <SetupGroup title="Hardware">
              <SetupInput
                label="OS"
                value={form.setup.os}
                onChange={(os) => updateSetup({ os })}
                listId="suggest-os"
                options={OS_SUGGESTIONS}
                placeholder="macOS"
                inputClass={inputClass}
              />
              <SetupInput
                label="Machine"
                value={form.setup.machine}
                onChange={(machine) => updateSetup({ machine })}
                placeholder="M4 Max MBP, 64GB"
                inputClass={inputClass}
              />
              <SetupInput
                label="Keyboard"
                value={form.setup.keyboard}
                onChange={(keyboard) => updateSetup({ keyboard })}
                placeholder="HHKB, split ergo, stock…"
                inputClass={inputClass}
              />
            </SetupGroup>

            <SetupGroup title="Editor & Terminal">
              <SetupInput
                label="Editor / IDE"
                value={form.setup.editor}
                onChange={(editor) => updateSetup({ editor })}
                listId="suggest-editor"
                options={EDITOR_SUGGESTIONS}
                placeholder="VS Code"
                inputClass={inputClass}
              />
              <SetupInput
                label="Terminal"
                value={form.setup.terminal}
                onChange={(terminal) => updateSetup({ terminal })}
                listId="suggest-terminal"
                options={TERMINAL_SUGGESTIONS}
                placeholder="Ghostty"
                inputClass={inputClass}
              />
              <SetupInput
                label="Shell"
                value={form.setup.shell}
                onChange={(shell) => updateSetup({ shell })}
                listId="suggest-shell"
                options={SHELL_SUGGESTIONS}
                placeholder="zsh"
                inputClass={inputClass}
              />
            </SetupGroup>

            <SetupGroup title="AI Stack">
              <SetupInput
                label="Primary agent"
                value={form.setup.primaryAgent}
                onChange={(primaryAgent) => updateSetup({ primaryAgent })}
                listId="suggest-primary-agent"
                options={PRIMARY_AGENT_SUGGESTIONS}
                placeholder="Claude Code"
                inputClass={inputClass}
              />
              <SetupInput
                label="Primary model"
                value={form.setup.primaryModel}
                onChange={(primaryModel) => updateSetup({ primaryModel })}
                listId="suggest-primary-model"
                options={PRIMARY_MODEL_SUGGESTIONS}
                placeholder="claude-sonnet-4"
                inputClass={inputClass}
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  MCP servers
                  <span className="ml-2 font-normal text-slate-400">
                    Review names before publishing — server names can hint at
                    private projects.
                  </span>
                </label>
                <input
                  type="text"
                  value={form.setup.mcpServers}
                  onChange={(e) => updateSetup({ mcpServers: e.target.value })}
                  placeholder="serena, playwright, supabase"
                  className={inputClass}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Comma-separated.
                </p>
              </div>
            </SetupGroup>

            <SetupGroup title="Workflow">
              <SetupInput
                label="Package manager"
                value={form.setup.packageManager}
                onChange={(packageManager) => updateSetup({ packageManager })}
                listId="suggest-package-manager"
                options={PACKAGE_MANAGER_SUGGESTIONS}
                placeholder="pnpm"
                inputClass={inputClass}
              />
              <SetupInput
                label="Dotfiles URL"
                value={form.setup.dotfilesUrl}
                onChange={(dotfilesUrl) => updateSetup({ dotfilesUrl })}
                placeholder="https://github.com/you/dotfiles"
                type="url"
                inputClass={inputClass}
              />
            </SetupGroup>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);

  const isOwnProfile = session?.user?.username === username;

  const handleDelete = async (slug: string) => {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    setDeleting(slug);
    try {
      const res = await fetch(buildReportApiUrl(username, slug), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              reports: prev.reports.filter((r) => r.slug !== slug),
              totalReports: prev.totalReports - 1,
            }
          : prev,
      );
    } catch {
      alert("Failed to delete report. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((json) => setProfile(json.data ?? json))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [username]);

  const handleSave = async (data: EditFormData) => {
    const setupPayload = formSetupToPayload(data.setup);
    const body = {
      displayName: data.displayName,
      bio: data.bio,
      githubUrl: data.githubUrl,
      twitterUrl: data.twitterUrl,
      linkedinUrl: data.linkedinUrl,
      websiteUrl: data.websiteUrl,
      // Explicit null clears the column; otherwise the normalized object is
      // sent as-is and the server handles shape validation.
      setup: Object.keys(setupPayload).length > 0 ? setupPayload : null,
    };

    const res = await fetch("/api/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Failed to save");
    }

    const json = await res.json();
    const updated = json.data;

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            displayName: updated.displayName,
            bio: updated.bio,
            githubUrl: updated.githubUrl,
            twitterUrl: updated.twitterUrl,
            linkedinUrl: updated.linkedinUrl,
            websiteUrl: updated.websiteUrl,
            setup: updated.setup ?? null,
          }
        : prev,
    );
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="animate-pulse">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div>
              <div className="h-6 w-32 rounded bg-slate-200 dark:bg-slate-700 mb-2" />
              <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <User className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-1">
          User not found
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No user with username &quot;{username}&quot; was found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Profile Header */}
      <div className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-5">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt=""
            width={80}
            height={80}
            className="rounded-full mb-3 sm:mb-0"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400 mb-3 sm:mb-0">
            <User className="h-8 w-8" />
          </div>
        )}

        <div className="flex-1">
          {editing ? (
            <ProfileEditForm
              profile={profile}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {profile.displayName || profile.username}
                </h1>
                {isOwnProfile && (
                  <button
                    onClick={() => setEditing(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Profile
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                @{profile.username}
              </p>
              {profile.bio && (
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {profile.bio}
                </p>
              )}

              <SocialLinks profile={profile} />

              {/* Stats */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <FileText className="h-4 w-4" />
                  <span className="font-semibold">
                    {profile.totalReports}
                  </span>{" "}
                  reports
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <Heart className="h-4 w-4" />
                  <span className="font-semibold">
                    {profile.totalVotes}
                  </span>{" "}
                  votes received
                </div>
                <div className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500">
                  <Calendar className="h-4 w-4" />
                  Joined{" "}
                  {new Date(profile.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Developer Setup (only renders when non-empty) */}
      <SetupCard setup={profile.setup} />

      {/* Reports */}
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        Shared Reports
      </h2>
      {profile.reports.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {profile.reports.map((report) => (
            <div key={report.slug} className="relative">
              <InsightCard
                slug={report.slug}
                title={report.title}
                authorUsername={profile.username}
                authorAvatar={profile.avatarUrl}
                authorDisplayName={profile.displayName}
                publishedAt={report.publishedAt}
                dateRangeStart={report.dateRangeStart}
                dateRangeEnd={report.dateRangeEnd}
                sessionCount={report.sessionCount}
                messageCount={report.messageCount}
                commitCount={report.commitCount}
                whatsWorkingPreview={report.whatsWorkingPreview}
                voteCount={report.voteCount}
                commentCount={report.commentCount}
                sectionTags={report.sectionTags}
              />
              {isOwnProfile && (
                <>
                  <Link
                    href={buildReportEditUrl(username, report.slug)}
                    // Always visible on touch devices (md:opacity-0
                    // hides it on desktop where hover-reveal works).
                    // Without the mobile-visible class, touch users
                    // have no way to reach the edit page from the
                    // profile — which is the whole point of this
                    // button.
                    className="absolute right-12 top-3 rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-400 opacity-100 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 md:opacity-0 group-hover:md:opacity-100 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-blue-700 dark:hover:bg-blue-950/50 dark:hover:text-blue-400 [div:hover>&]:md:opacity-100"
                    title="Edit report"
                    aria-label="Edit report"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDelete(report.slug)}
                    disabled={deleting === report.slug}
                    // Same mobile-visible treatment for consistency
                    // with the new Edit button.
                    className="absolute right-3 top-3 rounded-lg border border-slate-200 bg-white/90 p-1.5 text-slate-400 opacity-100 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-600 md:opacity-0 group-hover:md:opacity-100 dark:border-slate-700 dark:bg-slate-900/90 dark:hover:border-red-700 dark:hover:bg-red-950/50 dark:hover:text-red-400 [div:hover>&]:md:opacity-100"
                    title="Delete report"
                  >
                    {deleting === report.slug ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No reports shared yet.
          </p>
        </div>
      )}
    </div>
  );
}
