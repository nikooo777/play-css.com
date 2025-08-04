import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${process.env.API_URL}/blacklist`);

    if (!response.ok) {
      throw new Error('Failed to fetch blacklist');
    }

    const blacklistContent = await response.text();

    // Return the blacklist as a downloadable file
    return new NextResponse(blacklistContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="server_blacklist.txt"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch blacklist' },
      { status: 500 }
    );
  }
}
