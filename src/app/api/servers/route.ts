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
    });

    if (!response.ok) {
      throw new Error('Failed to fetch servers');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
} 