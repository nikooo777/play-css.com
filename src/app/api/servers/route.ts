import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET() {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for') || '';
    const realIp = forwardedFor.split(',')[0] || headersList.get('x-real-ip') || '';

    const response = await fetch(`${process.env.API_URL}/servers`, {
      headers: {
        'X-Forwarded-For': realIp,
        'X-Real-IP': realIp,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 503) {
        return new NextResponse(body, {
          status: response.status,
          headers: {
            'content-type': response.headers.get('content-type') ?? 'application/json',
            'cache-control': 'no-store',
          },
        });
      }
      throw new Error('Failed to fetch servers');
    }

    const data = await response.json();
    const proxied = NextResponse.json(data);
    for (const header of [
      'x-play-css-snapshot-source',
      'x-play-css-snapshot-age-seconds',
      'cache-control',
    ]) {
      const value = response.headers.get(header);
      if (value) {
        proxied.headers.set(header, value);
      }
    }
    return proxied;
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}
