import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(`${process.env.API_URL}/servers`);
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