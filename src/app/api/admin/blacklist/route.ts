import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const formData = await request.formData();
    const address = formData.get('address') as string;
    const reason = formData.get('reason') as string;

    if (!address) {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    const response = await fetch(`${process.env.API_URL}/admin/blacklist`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        address,
        reason: reason || 'none'
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      const errorData = await response.json().catch(() => ({ error: 'Failed to blacklist server' }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to blacklist server' },
      { status: 500 }
    );
  }
}