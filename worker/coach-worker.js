/**
 * Coach IA — Proxy seguro hacia la API de Anthropic para Oscar Fit 78.
 *
 * Este Worker es el ÚNICO lugar donde vive tu API key.
 * La PWA nunca la ve: le manda el mensaje + un resumen de tus datos,
 * y este Worker construye la llamada real a Claude.
 */

const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';

function corsHeaders(origin, allowedOrigin) {
  const allow = allowedOrigin === '*' ? '*' : (origin === allowedOrigin ? origin : allowedOrigin);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function buildSystemPrompt(context) {
  return `Eres el "Coach IA" dentro de la PWA personal de Oscar, Oscar Fit 78.

Contexto del plan de Oscar:
- 48 años, 1,80 m. Peso inicial 87 kg, objetivo 78 kg (pérdida de grasa abdominal manteniendo músculo).
- Entrena natación 5 días/semana y calistenia 3 días/semana.
- Dieta flexible (2.200-2.400 kcal, 150-170 g proteína), permite 2 cervezas casi a diario en verano.
- No quiere dietas imposibles ni un enfoque de culturista, sí un físico atlético sostenible.

Estado actual de Oscar (datos reales de su app, generados automáticamente):
${context}

Instrucciones de estilo:
- Responde en español, tono directo y pragmático, sin rodeos ni relleno motivacional excesivo.
- Sé breve por defecto (2-4 frases), profundiza solo si Oscar lo pide.
- Usa los datos reales de arriba para dar consejos concretos, no genéricos.
- Si los datos muestran una tendencia preocupante (dolor lumbar/hombro en subida, muchos días sin entrenar), dilo directamente.
- No eres un médico: para dolor persistente o síntomas serios, sugiere consultar a un profesional.`;
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin, allowedOrigin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { message, context, history } = await request.json();

      if (!message || typeof message !== 'string') {
        return new Response(JSON.stringify({ error: 'Falta el mensaje' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowedOrigin) },
        });
      }

      const messages = [
        ...(Array.isArray(history) ? history.slice(-10) : []),
        { role: 'user', content: message },
      ];

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 500,
          system: buildSystemPrompt(context || 'Sin datos disponibles todavía.'),
          messages,
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        return new Response(JSON.stringify({ error: 'Error de la API de Anthropic', detail: errText }), {
          status: anthropicRes.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowedOrigin) },
        });
      }

      const data = await anthropicRes.json();
      const reply = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

      return new Response(JSON.stringify({ reply }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowedOrigin) },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Error interno', detail: String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, allowedOrigin) },
      });
    }
  },
};
