import type { NextRequest } from "next/server";
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Roda em tudo, exceto assets estáticos, imagens e o service worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.webmanifest|sw.js|workbox-.*|fallback-.*|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
