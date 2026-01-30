import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

function httpPost(url: string, data: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
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
    req.write(postData);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  const AGENTS_URL = process.env.AGENTS_URL || 'http://localhost:6000';
  
  try {
    const body = await request.json();
    const result = await httpPost(`${AGENTS_URL}/chat`, body);
    
    if (result.status !== 200) {
      return NextResponse.json(
        { error: result.data?.error || 'Failed to get AI response' },
        { status: result.status }
      );
    }
    
    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('Chat proxy error:', error.message);
    return NextResponse.json(
      { error: 'Failed to connect to AI service' },
      { status: 500 }
    );
  }
}
