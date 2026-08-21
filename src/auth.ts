import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  passkeyLoginTokens,
} from "@/db/schema";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  // 反向代理后必须信任 x-forwarded-* 头，否则回调 URL 和 CSRF 会校验失败
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      id: "username",
      name: "username",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string;
        const password = credentials?.password as string;

        if (!username || !password) return null;
        if (username.length < 3) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.username, username),
        });

        if (!user) return null;
        if (!user.passwordHash) return null;

        const { verifyPassword } = await import("@/lib/password");
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.name, username: user.username };
      },
    }),
    Credentials({
      id: "passkey",
      name: "passkey",
      credentials: {
        loginToken: { label: "登录令牌", type: "text" },
      },
      async authorize(credentials) {
        const loginToken = credentials?.loginToken as string;
        if (!loginToken) return null;

        const token = await db.query.passkeyLoginTokens.findFirst({
          where: eq(passkeyLoginTokens.token, loginToken),
        });

        if (!token) return null;
        if (token.used) return null;
        if (token.expiresAt < new Date()) return null;

        await db
          .update(passkeyLoginTokens)
          .set({ used: true })
          .where(eq(passkeyLoginTokens.token, loginToken));

        const user = await db.query.users.findFirst({
          where: eq(users.id, token.userId),
        });

        if (!user) return null;

        return { id: user.id, name: user.name, username: user.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.username) (session.user as any).username = token.username;
      return session;
    },
  },
});