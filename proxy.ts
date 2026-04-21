// Next.js 16 renamed `middleware.ts` to `proxy.ts`. Runs on every request
// before the route handler — our only responsibility here is keeping the
// Supabase session cookie fresh.
import type { NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimizer; everything else goes through.
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
