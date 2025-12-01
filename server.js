import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, ".env") });

// ✅ Only use GEMINI_API_KEY
const GEMINI_KEY = (process.env.GEMINI_API_KEY || "").trim();

// Debug
console.log("GEMINI_API_KEY preview:", GEMINI_KEY.slice(0, 12) + "...");
console.log("startsWith('AIza'):", GEMINI_KEY.startsWith("AIza"));

const hasKey = GEMINI_KEY.startsWith("AIza");

// ✅ Initialize Gemini Client (NEW STYLE)
const ai = new GoogleGenAI({
  apiKey: GEMINI_KEY
});

// Express + Socket.io
const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Prevent spam
const COOLDOWN_MS = 6000;
let lastCall = 0;

async function getMeanFortune() {
  const fallback = ["fallback"];
  if (!hasKey) return fallback[0];

  // ---- NEW: safe locals so template literals don’t throw ----
  const recentBlock = globalThis.recentBlock ?? ""; // if you set it elsewhere, it’ll be used
  const seed = globalThis.seed ?? Math.floor(Math.random() * 1e9); // harmless fallback
  // -----------------------------------------------------------

  const topics = ["color", "layout", "whitespace", "alignment", "motion", "contrast"];
  const topic = topics[Math.floor(Math.random() * topics.length)];

  // ---- UPDATED PROMPT per your rules (no emojis, no hashtags; may end with ?) ----
  const prompt = `Give me a long list of short demotivational one-liners in a casual Gen-Z tone. Each line should start randomly with words like ‘bro’, ‘lol’, ‘damn’, ‘sheesh’, ‘bruh’, ngl, sis, etc. The quotes should feel funny, slightly mean, sarcastic, relatable to middle-class reality (money issues, rent, work stress, inflation, burnout). No poetry. No long explanations. Just punchline sentences, digestible, sadistic, and brutally honest. Mix humor with violent contrast. Keep it simple and casual. Make every line feel like a prophecy delivered by a tired Gen-Z oracle

Return EXACTLY one line.
4–10 words.
No question marks.
No emojis.
No hashtags.
No lists.
No dramatic punctuation.

Avoid any mention of “dribbble.”

Avoid repeating phrasing from recent outputs:
${recentBlock || "(none yet)"}

`;


  const user = `Give ONE short, punchy design-culture roast (5–12 words).
Different from recent lines. May end with a question mark.
seed=${seed}`.trim();

  try {
    // ✅ NEW MODEL CALL (Matches doc exactly)
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    console.log("RAW MODEL RESPONSE:", response.text); // debug

    const text = (response.text || "").trim();
    return text || fallback[0];

  } catch (err) {
    console.error("[Gemini ERROR]", err.message);
    return fallback[0];
  }
}

app.get("/fortune", async (_req, res) => {
  const now = Date.now();
  if (now - lastCall < COOLDOWN_MS) {
    return res.json({ ai: hasKey, text: "chill. let it cook.", cooldown: true });
  }
  lastCall = now;
  res.setHeader("Cache-Control", "no-store");
  res.json({ ai: hasKey, text: await getMeanFortune(), t: now });
});

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  socket.on("control:update", async (payload) => {
    if (payload?.cmd === "trigger") {
      io.emit("visual:state", { cmd: "loading", t: Date.now() }); // 1) immediate
      const fortune = await getMeanFortune();                      // 2) wait Gemini
      io.emit("visual:state", { cmd: "show", text: fortune, t: Date.now() }); // 3) show
    }
  });

  socket.on("disconnect", () => console.log("client disconnected:", socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
