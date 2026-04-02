import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { path } = request.query;
  // Use VITE_ prefix for consistency with client-side, but process.env is correct on server
  const API_KEY = process.env.VITE_FOOTBALL_DATA_API_KEY || process.env.FOOTBALL_DATA_API_KEY || '7dc3a9b5ab2f40528306816332f56c86';
  const BASE_URL = 'https://api.football-data.org/v4';

  if (!path) {
    return response.status(400).json({ error: 'Path is required' });
  }

  try {
    const targetUrl = `${BASE_URL}/${path}`;
    console.log(`Proxying request to: ${targetUrl}`);
    
    const res = await fetch(targetUrl, {
      headers: {
        'X-Auth-Token': API_KEY,
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    
    // Set CORS headers just in case
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token');
    
    if (request.method === 'OPTIONS') {
      return response.status(200).end();
    }

    return response.status(res.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return response.status(500).json({ 
      error: 'Failed to fetch football data from proxy',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
