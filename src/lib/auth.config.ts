import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

// Note: the reserved-username check lives in src/lib/auth.ts (signIn
// callback). It must run in the node runtime so it can query Prisma to
// distinguish first-time signups from existing users whose GitHub login
// changed to a reserved name. This file is loaded by middleware in the
// edge runtime where Prisma cannot run.

export default {
  pages: { signIn: "/login" },
  providers: [GitHub],
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      // R22 (Wave 4 Unit 9): the /upload page now has an unauth landing
      // state — the example report preview and a "Sign in with GitHub"
      // CTA. Visitors must be able to see it before authenticating, so
      // we no longer block /upload at the middleware layer. The page
      // itself toggles between the unauth landing and the authed
      // tokenized flow based on the next-auth session.
      void auth;
      void nextUrl;
      return true;
    },
  },
} satisfies NextAuthConfig;
