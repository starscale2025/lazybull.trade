// NextAuth catch-all — handles /api/auth/signin, /api/auth/callback/google,
// /api/auth/signout, /api/auth/session, etc.

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
