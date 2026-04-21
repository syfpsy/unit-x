import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Clears the Supabase session cookie and bounces the client back home.
 * Called by the `/logout` slash command via fetch.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const { origin } = new URL(req.url);
  return NextResponse.redirect(origin, { status: 303 });
}
