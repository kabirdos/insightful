import type { Metadata } from "next";

// Group pages render member harness stats (tokens, sessions, commits,
// skills). Like individual report pages they should be shareable and
// search-indexable but NOT harvested into AI training corpora. `noai`/
// `noimageai` are the opt-out directives read from the `robots` meta
// name; Next's typed `robots` object doesn't model them, so we emit
// them via `other`. No `noindex`/`nofollow` — default index/follow stays
// intact. The group detail page itself is a client component, so this
// static layout is where the server-rendered <head> metadata lives.
export const metadata: Metadata = {
  other: { robots: "noai, noimageai" },
};

export default function GroupSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
