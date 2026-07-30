import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(`${process.env.API_URL}/blacklist/count`, {
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') ?? 'application/json',
        'cache-control': response.headers.get('cache-control') ?? 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Blacklist count unavailable' },
      { status: 502 }
    );
  }
}
