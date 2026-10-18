import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Roda em tudo, exceto assets estáticos e imagens.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
