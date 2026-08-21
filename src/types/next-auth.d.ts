import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    username?: string | null;
  }

  interface Session extends DefaultSession {
    user: {
      id: string;
      username?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string | null;
  }
}