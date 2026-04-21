import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Magic-link landing. Supabase projects now use PKCE by default — the
 * email link hits Supabase's /auth/v1/verify, which redirects here with
 * a `?code=…` param we exchange for a session. Older email templates
 * still produce `?token_hash=…&type=magiclink` instead, so we accept
 * either shape. Any Supabase-side failure lands on the home page with
 * `?auth_error=…` so the IDENTIFY card can surface a readable message.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';
  const passthroughError = searchParams.get('error_description');

  if (passthroughError) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(passthroughError)}`,
    );
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/?auth_error=missing%20auth%20code`);
}
