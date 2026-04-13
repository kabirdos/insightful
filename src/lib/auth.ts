import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { prisma } from "./db";
import { isReservedUsername } from "./reserved-usernames";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      // Reject signups whose GitHub login matches a reserved app route,
      // but ONLY for first-time signups. Existing users keep their account
      // even if they later rename on GitHub to a reserved name (their
      // stored username is immutable, so no URL conflict can result).
      const githubLogin = profile?.login as string | undefined;
      if (!githubLogin) return true;

      if (!isReservedUsername(githubLogin)) return true;

      const githubId = profile?.id ? String(profile.id) : null;
      if (!githubId) {
        // No id means we can't tell if this is an existing user — be safe.
        return "/login?error=ReservedUsername";
      }

      const existing = await prisma.user.findUnique({
        where: { githubId },
        select: { id: true },
      });
      if (existing) return true;

      return "/login?error=ReservedUsername";
    },
    async jwt({ token, profile }) {
      if (profile) {
        const githubId = String(profile.id);
        const username = (profile.login as string) ?? `user-${githubId}`;
        const displayName = (profile.name as string | undefined) ?? null;
        const avatarUrl = (profile.avatar_url as string | undefined) ?? null;

        // Upsert user in the jwt callback to ensure it exists before we read it.
        // Note: username is only set on `create`, never on `update`. The username
        // captured at first sign-in is the permanent URL identifier. If the user
        // renames on GitHub, displayName and avatarUrl sync but username does not.
        const user = await prisma.user.upsert({
          where: { githubId },
          create: { githubId, username, displayName, avatarUrl },
          update: { displayName, avatarUrl },
        });

        token.sub = user.id;
        token.username = user.username;
      } else if (token.sub && !token.username) {
        // Existing session without username — look it up from DB
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { username: true },
        });
        if (user) token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.username) session.user.username = token.username as string;
      return session;
    },
  },
});
