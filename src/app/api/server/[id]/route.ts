import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

interface Params {
  id: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const awaitedParams = await params;
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for') || '';
    const realIp = forwardedFor.split(',')[0] || headersList.get('x-real-ip') || '';
    
    const response = await fetch(`${process.env.API_URL}/server/${awaitedParams.id}`, {
      headers: {
        'X-Forwarded-For': realIp,
        'X-Real-IP': realIp,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch server details');
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch server details' },
      { status: 500 }
    );
  }
}
