import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isReservedUsername } from "@/lib/reserved-usernames";

/**
 * Server layout wrapper for the root-level /[username] route.
 *
 * The underlying page is a client component that shows "User not found" at
 * HTTP 200 when the user doesn't exist. Without this wrapper, every typo or
 * bad link to a non-existent username would return 200 — bad for SEO and for
 * clients (crawlers, share-card fetchers) that rely on a real 404 status.
 *
 * This layout runs on the server BEFORE the client page mounts. It checks
 * that the username exists (and isn't reserved) and calls notFound() if not,
 * which produces an actual 404 response.
 */
export default async function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Reserved usernames can never own a profile — return 404 before even
  // querying the DB. (Defense-in-depth: signup-time check in auth.config.ts
  // is the primary enforcement.)
  if (isReservedUsername(username)) {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    notFound();
  }

  return <>{children}</>;
}
