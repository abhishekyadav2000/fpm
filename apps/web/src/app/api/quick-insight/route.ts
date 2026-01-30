import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

function httpPost(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  const AGENTS_URL = process.env.AGENTS_URL || 'http://localhost:6000';
  
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id') || 'default';
    
    const result = await httpPost(`${AGENTS_URL}/quick-insight?user_id=${userId}`);

    if (result.status !== 200) {
      return NextResponse.json({ insight: null }, { status: 200 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Quick insight proxy error:', error);
    return NextResponse.json({ insight: null }, { status: 200 });
  }
}
