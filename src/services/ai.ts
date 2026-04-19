// AI Service — Gemini (primary) → Cerebras (fallback 1) → Groq (fallback 2)
// All providers are free tier

interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiResponse {
  text: string;
  provider: 'gemini' | 'cerebras' | 'groq';
  model: string;
  responseTimeMs: number;
}

// --- Gemini (Google AI) ---

async function callGemini(messages: AiMessage[]): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');

  const contents = userMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: Record<string, unknown> = { contents };
  if (systemMessage) {
    body.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');

  return { text, model: 'gemini-2.0-flash' };
}

// --- Cerebras ---

async function callCerebras(messages: AiMessage[]): Promise<{ text: string; model: string }> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not set');

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama3.1-8b',
      messages,
      temperature: 0.7,
      max_completion_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cerebras API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras returned empty response');

  return { text, model: 'llama3.1-8b' };
}

// --- Groq ---

async function callGroq(messages: AiMessage[]): Promise<{ text: string; model: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned empty response');

  return { text, model: 'llama-3.3-70b-versatile' };
}

// --- Main: Gemini → Cerebras → Groq ---

export async function askAi(messages: AiMessage[]): Promise<AiResponse> {
  // 1. Try Gemini first
  if (process.env.GEMINI_API_KEY) {
    try {
      const start = Date.now();
      const result = await callGemini(messages);
      return {
        text: result.text,
        provider: 'gemini',
        model: result.model,
        responseTimeMs: Date.now() - start,
      };
    } catch (err) {
      console.error('⚠️ Gemini failed, falling back to Cerebras:', err instanceof Error ? err.message : err);
    }
  }

  // 2. Fallback to Cerebras
  if (process.env.CEREBRAS_API_KEY) {
    try {
      const start = Date.now();
      const result = await callCerebras(messages);
      return {
        text: result.text,
        provider: 'cerebras',
        model: result.model,
        responseTimeMs: Date.now() - start,
      };
    } catch (err) {
      console.error('⚠️ Cerebras failed, falling back to Groq:', err instanceof Error ? err.message : err);
    }
  }

  // 3. Last resort: Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const start = Date.now();
      const result = await callGroq(messages);
      return {
        text: result.text,
        provider: 'groq',
        model: result.model,
        responseTimeMs: Date.now() - start,
      };
    } catch (err) {
      console.error('⚠️ Groq failed:', err instanceof Error ? err.message : err);
      throw new Error('All AI providers failed. Check API keys.');
    }
  }

  throw new Error('No AI API keys configured. Set GEMINI_API_KEY, CEREBRAS_API_KEY, or GROQ_API_KEY in environment.');
}
