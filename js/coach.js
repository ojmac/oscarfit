/* coach.js — Chat del Coach IA, conectado al Worker proxy */

const COACH_SETTINGS_ID = 'coach';

async function getCoachEndpoint() {
  const settings = await DB.get('settings', COACH_SETTINGS_ID);
  return settings ? settings.endpoint : '';
}

async function setCoachEndpoint(url) {
  await DB.put('settings', { id: COACH_SETTINGS_ID, endpoint: url });
}

async function buildContextSummary() {
  const profile = await getProfile();
  const weights = (await DB.getAll('weightLogs')).sort((a, b) => a.date.localeCompare(b.date));
  const pesoActual = weights.length ? weights[weights.length - 1].peso : profile.pesoInicial;

  const today = todayStr();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const swims = (await DB.getAll('swimWorkouts')).filter((s) => s.date >= sevenDaysAgo);
  const cal = (await DB.getAll('calisthenicsWorkouts')).filter((c) => c.date >= sevenDaysAgo);
  const beers = (await DB.getAll('beers')).filter((b) => b.date >= sevenDaysAgo);
  const health = (await DB.getAll('healthLogs')).sort((a, b) => b.date.localeCompare(a.date))[0];

  const metrosSemana = swims.reduce((s, w) => s + (w.metros || 0), 0);

  const lines = [
    `- Peso actual: ${pesoActual} kg (objetivo ${profile.pesoObjetivo} kg, inicial ${profile.pesoInicial} kg)`,
    `- Natación últimos 7 días: ${swims.length} sesiones, ${metrosSemana} m en total`,
    `- Calistenia últimos 7 días: ${cal.length} sesiones registradas`,
    `- Cervezas últimos 7 días: ${beers.length}`,
  ];

  if (health) {
    lines.push(`- Último registro de salud (${health.date}): cintura ${health.cintura ?? '—'} cm, sueño ${health.sueno ?? '—'} h, ánimo ${health.animo ?? '—'}/5, dolor lumbar ${health.lumbar ?? '—'}/10, molestia hombro ${health.hombro ?? '—'}/10`);
  }

  lines.push(`- Hoy es ${today}`);

  return lines.join('\n');
}

function coachBubble(text, who) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${who}`;
  div.textContent = text;
  return div;
}

async function renderCoachHistory() {
  const container = document.getElementById('coach-messages');
  const msgs = (await DB.getAll('coachMessages')).sort((a, b) => a.id - b.id);
  container.innerHTML = '';
  if (!msgs.length) {
    container.appendChild(coachBubble('Hola, soy tu Coach IA. Puedo ver tu progreso real (peso, entrenos, nutrición) y ayudarte a decidir el siguiente paso. ¿En qué te ayudo?', 'coach'));
    return;
  }
  msgs.forEach((m) => container.appendChild(coachBubble(m.text, m.role === 'user' ? 'user' : 'coach')));
  container.scrollTop = container.scrollHeight;
}

async function initCoachSection() {
  const endpoint = await getCoachEndpoint();
  document.getElementById('coach-config-card').style.display = endpoint ? 'none' : 'block';
  await renderCoachHistory();
}

async function sendCoachMessage() {
  const input = document.getElementById('input-coach-mensaje');
  const text = input.value.trim();
  if (!text) return;

  const endpoint = await getCoachEndpoint();
  if (!endpoint) {
    showToast('Configura primero la URL del Worker');
    return;
  }

  const container = document.getElementById('coach-messages');
  container.appendChild(coachBubble(text, 'user'));
  await DB.add('coachMessages', { date: todayStr(), role: 'user', text });
  input.value = '';
  container.scrollTop = container.scrollHeight;

  const typingEl = coachBubble('Escribiendo…', 'coach typing');
  container.appendChild(typingEl);
  container.scrollTop = container.scrollHeight;

  try {
    const history = (await DB.getAll('coachMessages'))
      .sort((a, b) => a.id - b.id)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.text }));

    const context = await buildContextSummary();

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, context, history: history.slice(0, -1) })
    });

    const data = await res.json();
    typingEl.remove();

    if (!res.ok || data.error) {
      container.appendChild(coachBubble('Error al contactar con el Coach IA. Revisa la configuración del Worker.', 'coach'));
      return;
    }

    container.appendChild(coachBubble(data.reply, 'coach'));
    await DB.add('coachMessages', { date: todayStr(), role: 'assistant', text: data.reply });
    container.scrollTop = container.scrollHeight;

  } catch (e) {
    typingEl.remove();
    container.appendChild(coachBubble('No se pudo conectar. ¿Tienes internet y la URL del Worker es correcta?', 'coach'));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const endpoint = await getCoachEndpoint();
  document.getElementById('input-coach-endpoint').value = endpoint || '';

  document.getElementById('btn-guardar-endpoint').addEventListener('click', async () => {
    const url = document.getElementById('input-coach-endpoint').value.trim();
    if (!url) return showToast('Introduce una URL válida');
    await setCoachEndpoint(url);
    document.getElementById('coach-config-card').style.display = 'none';
    showToast('Coach IA configurado');
  });

  document.getElementById('btn-coach-enviar').addEventListener('click', sendCoachMessage);
  document.getElementById('input-coach-mensaje').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendCoachMessage();
  });

  document.addEventListener('section:change', (e) => {
    if (e.detail.section === 'coach') initCoachSection();
  });
});
