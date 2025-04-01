import { NextResponse } from 'next/server';

interface Params {
  id: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  try {
    const awaitedParams = await params;
    
    const response = await fetch(`${process.env.API_URL}/server/${awaitedParams.id}`);
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
