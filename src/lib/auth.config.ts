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
      const isLoggedIn = !!auth?.user;

      // Protect upload page
      if (nextUrl.pathname.startsWith("/upload") && !isLoggedIn) {
        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
