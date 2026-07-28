import { NextRequest, NextResponse } from 'next/server';

const READ_ENDPOINTS = new Set(['audit', 'banned', 'observations']);
const MUTATION_ENDPOINTS = new Set(['add', 'blacklist', 'unban', 'unblacklist']);
const REQUEST_TIMEOUT = 10_000;

interface RouteParams {
  endpoint: string;
}

function jsonError(error: string, status: number, data?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(data ? { data } : {}),
    },
    { status }
  );
}

function authorizationFrom(request: NextRequest): string | null {
  return request.headers.get('authorization');
}

async function forwardResponse(response: Response): Promise<NextResponse> {
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { endpoint } = await params;
  if (!READ_ENDPOINTS.has(endpoint)) {
    return jsonError('Admin endpoint not found', 404);
  }

  const authorization = authorizationFrom(request);
  if (!authorization) {
    return jsonError('Authorization required', 401);
  }

  try {
    const search = request.nextUrl.search;
    const response = await fetch(
      `${process.env.API_URL}/admin/${endpoint}${search}`,
      {
        headers: {
          Authorization: authorization,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }
    );
    return forwardResponse(response);
  } catch {
    return jsonError(`Failed to fetch admin ${endpoint}`, 502);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  const { endpoint } = await params;
  if (!MUTATION_ENDPOINTS.has(endpoint)) {
    return jsonError('Admin endpoint not found', 404);
  }

  const authorization = authorizationFrom(request);
  if (!authorization) {
    return jsonError('Authorization required', 401);
  }

  const idempotencyKey = request.headers.get('idempotency-key');
  if (!idempotencyKey) {
    return jsonError('Idempotency-Key required', 400);
  }

  try {
    const formData = await request.formData();
    const body = new URLSearchParams();
    formData.forEach((value, key) => {
      if (typeof value === 'string') {
        body.append(key, value);
      }
    });

    const response = await fetch(`${process.env.API_URL}/admin/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    return forwardResponse(response);
  } catch {
    return jsonError('Mutation result is unknown', 503, {
      operation_key: idempotencyKey,
      retry_same_key: true,
    });
  }
}
