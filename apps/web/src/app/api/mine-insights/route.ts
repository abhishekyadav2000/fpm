import { NextRequest, NextResponse } from 'next/server';
import http from 'http';

const AGENTS_URL = process.env.AGENTS_URL || 'http://localhost:6000';

function httpPost(url: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 80,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await httpPost(`${AGENTS_URL}/mine-insights`, body);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Mine insights error:', error);
    return NextResponse.json(
      { error: 'Failed to mine insights', insights: [] },
      { status: 500 }
    );
  }
}
