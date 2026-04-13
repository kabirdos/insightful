// Profile "developer setup" fields — uses.tech-style workstation info
// rendered on public profiles. Stored as a single Json blob on User.setup.
// See docs/plans/2026-04-13-profile-setup-fields.md.

export const PROFILE_SETUP_VERSION = 1 as const;

/** Keys users can set directly via the edit form. */
export const PROFILE_SETUP_USER_KEYS = [
  "os",
  "machine",
  "keyboard",
  "editor",
  "terminal",
  "shell",
  "primaryAgent",
  "primaryModel",
  "mcpServers",
  "packageManager",
  "dotfilesUrl",
] as const;

export type ProfileSetupUserKey = (typeof PROFILE_SETUP_USER_KEYS)[number];

export interface ProfileSetupUserFields {
  os?: string;
  machine?: string;
  keyboard?: string;
  editor?: string;
  terminal?: string;
  shell?: string;
  primaryAgent?: string;
  primaryModel?: string;
  mcpServers?: string[];
  packageManager?: string;
  dotfilesUrl?: string;
}

export interface ProfileSetup extends ProfileSetupUserFields {
  // Server-owned metadata. Never accept from client; normalizeSetup always
  // overwrites these. setupUpdatedAt is refreshed only when the normalized
  // user-fields payload differs from what's already stored.
  version: typeof PROFILE_SETUP_VERSION;
  setupUpdatedAt: string; // ISO-8601
}

/**
 * Subset the derive helper can emit. Ordering mirrors Phase D source-field
 * precedence in the plan.
 */
export type DerivedSetupFields = Partial<
  Pick<
    ProfileSetupUserFields,
    "primaryAgent" | "primaryModel" | "mcpServers" | "packageManager" | "os"
  >
>;

export type ProfileSetupLimits = {
  FREE_TEXT_MAX: 120;
  MCP_ARRAY_MAX: 20;
  MCP_ITEM_MAX: 80;
};

export const PROFILE_SETUP_LIMITS: ProfileSetupLimits = {
  FREE_TEXT_MAX: 120,
  MCP_ARRAY_MAX: 20,
  MCP_ITEM_MAX: 80,
};
