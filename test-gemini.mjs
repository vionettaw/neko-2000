import "dotenv/config";

const KEY = (process.env.GEMINI_API_KEY || "").trim();
console.log("Using key:", KEY.slice(0, 10) + "...");

if (!KEY.startsWith("AIza")) {
  console.log("❌ Key missing or wrong. Fix .env first.");
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(KEY)}`;

const body = {
  contents: [{ parts: [{ text: "You are a mean Gen-Z designer oracle. Tell a past, present or future fortune in 5-10 words for a designer. It can be positive and negative in random times." }] }]
};

const resp = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const json = await resp.json();
console.log("RESPONSE:", JSON.stringify(json, null, 2));
