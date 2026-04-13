-- Add optional JSON blob to User for the "developer setup" profile fields
-- (OS, editor, terminal, primary model, MCP servers, etc.). Display-only.
-- See docs/plans/2026-04-13-profile-setup-fields.md.
ALTER TABLE "User" ADD COLUMN "setup" JSONB;
