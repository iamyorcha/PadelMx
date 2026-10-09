import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = parseInt(process.env.PORT || "3000", 10);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Gemini API client lazy initialization
  let genAI: GoogleGenAI | null = null;
  function getGenAI() {
    if (!genAI) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is required");
      }
      genAI = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return genAI;
  }

  // API Route for Tournament Summary
  app.post("/api/tournament-summary", async (req, res) => {
    try {
      const { tournamentData } = req.body;
      const ai = getGenAI();
      
      const prompt = `
        Eres un comentarista experto de pádel. Analiza los siguientes datos de un torneo de pádel Americano y genera un resumen emocionante, breve y profesional (máximo 150 palabras). 
        Destaca a los ganadores, el espíritu de competencia y menciona algún dato curioso si lo hay en los resultados.
        
        Datos del Torneo:
        ${JSON.stringify(tournamentData, null, 2)}
      `;

      const maxRetries = 3;
      let lastError: any;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const result = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt
          });
          const summary = result.text || "No se pudo generar el resumen en este momento.";
          res.json({ summary });
          return;
        } catch (err: any) {
          lastError = err;
          const is503 = err.status === 503;
          if (!is503 || attempt === maxRetries - 1) break;
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      }
      // All retries exhausted — return a graceful fallback instead of a hard 500
      console.warn(`Gemini summary unavailable after ${maxRetries} attempts (status ${lastError?.status ?? "unknown"}).`);
      res.json({ summary: "El resumen no está disponible en este momento debido a alta demanda del servicio. Intenta nuevamente en unos minutos." });
    } catch (error: any) {
      console.error("Server Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate summary" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", api: "Gemini is configured" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
