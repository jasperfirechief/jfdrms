import { streamText } from "ai";

const SUPABASE_URL = "https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "POST");
    return res.end("Method not allowed");
  }

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    res.statusCode = 401;
    return res.end("Authentication required");
  }

  const userCheck = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: auth
    }
  });

  if (!userCheck.ok) {
    res.statusCode = 401;
    return res.end("Invalid or expired session");
  }

  let body;
  try {
    body = await req.body;
    if (typeof body === "string") body = JSON.parse(body);
  } catch {
    body = null;
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 12000) {
    res.statusCode = 400;
    return res.end("Prompt is required and must be 12,000 characters or fewer");
  }

  const result = streamText({
    model: "openai/gpt-6-astra",
    system: "You are the Jasper Fire Department RMS assistant. Give practical, concise, professional assistance. Do not invent department records, policies, laws, incident facts, or personnel information. When the user asks for a report, write clear professional fire-service language. Treat user-provided operational information as the source of truth.",
    prompt,
    maxOutputTokens: 2000
  });

  const response = result.toTextStreamResponse();
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) return res.end();
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
}