import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, profile }) {
      // On sign-in, profile is available — attach our DB user id
      if (profile) {
        const githubId = String(profile.id);
        const user = await prisma.user.findUnique({ where: { githubId } });
        if (user) {
          token.sub = user.id;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async signIn({ profile }) {
      if (!profile?.id) return;

      const githubId = String(profile.id);
      const username = (profile.login as string) ?? `user-${githubId}`;
      const displayName = (profile.name as string | undefined) ?? null;
      const avatarUrl = (profile.avatar_url as string | undefined) ?? null;

      await prisma.user.upsert({
        where: { githubId },
        create: { githubId, username, displayName, avatarUrl },
        update: { displayName, avatarUrl },
      });
    },
  },
});
