-- Drop the legacy ProjectLink table. All consumers (upload flow,
-- API routes, detail page, seed files) have been migrated to the
-- new Project + ReportProject models in Units 1-4.
--
-- INTENTIONALLY DESTRUCTIVE: this migration does NOT backfill
-- existing ProjectLink rows into the new Project + ReportProject
-- tables. This is a locked design decision (see Decision 2 in
-- docs/superpowers/specs/2026-04-10-persistent-projects-and-link-
-- previews-design.md and the user's direction during brainstorming
-- on 2026-04-10: "We have almost no real users now, so do what you
-- think"). Any pre-existing ProjectLink rows in production are
-- dropped on purpose. Users must re-attach their projects via the
-- new library UI in Unit 7.
--
-- If this feature is ever revived in a world with real user data,
-- write a backfill script that copies each ProjectLink into a
-- Project (owned by the report's authorId) + a ReportProject
-- junction row BEFORE running this DROP.

DROP TABLE IF EXISTS "ProjectLink";
