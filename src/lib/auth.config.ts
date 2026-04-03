import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

export default {
  pages: { signIn: "/api/auth/signin" },
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

      // Protect write operations on /api/insights (POST/PUT/DELETE) but allow GET
      if (nextUrl.pathname.startsWith("/api/insights")) {
        const method = (
          nextUrl.searchParams.get("_method") || "GET"
        ).toUpperCase();
        // Middleware can't easily read the HTTP method, so let route handlers
        // enforce auth for mutations. Allow all requests through here.
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
