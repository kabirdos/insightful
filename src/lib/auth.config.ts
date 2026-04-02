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
      const protectedPaths = ["/upload", "/api/insights"];
      const isProtected = protectedPaths.some((p) =>
        nextUrl.pathname.startsWith(p),
      );
      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
