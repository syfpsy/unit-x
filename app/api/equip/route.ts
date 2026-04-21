import { type NextRequest, NextResponse } from 'next/server';
import { getOperator } from '@/lib/auth/getOperator';
import { equipCosmetic } from '@/lib/db/cosmetics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EquipBody {
  slug: string;
}

export async function POST(req: NextRequest) {
  let body: EquipBody;
  try {
    body = (await req.json()) as EquipBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const slug = (body.slug || '').trim();
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 });

  const op = await getOperator();
  if (!op) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const result = await equipCosmetic({ operatorId: op.id, slug });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ equipped: result });
}
