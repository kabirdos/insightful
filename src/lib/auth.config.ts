import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";
import { isReservedUsername } from "./reserved-usernames";

export default {
  pages: { signIn: "/login" },
  providers: [GitHub],
  callbacks: {
    signIn({ profile }) {
      // Reject signups whose GitHub login matches a reserved app route.
      // Returning a redirect path preserves the reason through NextAuth's
      // redirect chain — throwing here would be wrapped as a generic
      // CallbackRouteError and lose the rejection reason.
      const githubLogin = profile?.login as string | undefined;
      if (githubLogin && isReservedUsername(githubLogin)) {
        return "/login?error=ReservedUsername";
      }
      return true;
    },
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
