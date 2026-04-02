import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = '7dc3a9b5ab2f40528306816332f56c86';
const BASE_URL = 'https://api.football-data.org/v4';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Football Data
  app.get("/api/football/*", async (req, res) => {
    const endpoint = req.params[0];
    const queryParams = new URLSearchParams(req.query as any).toString();
    const url = `${BASE_URL}/${endpoint}${queryParams ? '?' + queryParams : ''}`;

    try {
      console.log(`Proxying request to: ${url}`);
      const response = await fetch(url, {
        headers: { 'X-Auth-Token': API_KEY }
      });

      const data = await response.json();
      console.log(`API Response Status: ${response.status}, Matches found: ${data.matches?.length || 0}`);
      res.status(response.status).json(data);
    } catch (error) {
      console.error('Proxy Error:', error);
      res.status(500).json({ error: 'Failed to fetch from football-data.org' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
