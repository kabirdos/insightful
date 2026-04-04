import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, profile }) {
      if (profile) {
        const githubId = String(profile.id);
        const username = (profile.login as string) ?? `user-${githubId}`;
        const displayName = (profile.name as string | undefined) ?? null;
        const avatarUrl = (profile.avatar_url as string | undefined) ?? null;

        // Upsert user in the jwt callback to ensure it exists before we read it
        const user = await prisma.user.upsert({
          where: { githubId },
          create: { githubId, username, displayName, avatarUrl },
          update: { displayName, avatarUrl },
        });

        token.sub = user.id;
        token.username = user.username;
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
