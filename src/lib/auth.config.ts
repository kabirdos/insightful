import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

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
