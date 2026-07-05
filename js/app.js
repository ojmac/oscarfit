/* app.js — Lógica principal de Oscar Fit 78 */

const PROFILE_DEFAULT = {
  id: 'main',
  nombre: 'Oscar',
  altura: 1.80,
  pesoInicial: 87,
  pesoObjetivo: 78,
  fechaInicio: new Date().toISOString().slice(0, 10),
  quitSmokingDate: null
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function daysBetween(dateStr) {
  if (!dateStr) return 0;
  const d1 = new Date(dateStr);
  const d2 = new Date();
  return Math.max(0, Math.floor((d2 - d1) / 86400000));
}

let charts = {};

function renderLineChart(canvasId, labels, data, label, color) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color || '#38bdf8',
        backgroundColor: 'rgba(56,189,248,0.15)',
        tension: 0.3,
        fill: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}

async function getProfile() {
  let profile = await DB.get('profile', 'main');
  if (!profile) {
    profile = PROFILE_DEFAULT;
    await DB.put('profile', profile);
  }
  return profile;
}

async function ensureLatestWeight(profile) {
  const logs = await DB.getAll('weightLogs');
  logs.sort((a, b) => a.date.localeCompare(b.date));
  const last = logs[logs.length - 1];
  return last ? last.peso : profile.pesoInicial;
}

/* ---------------- DASHBOARD ---------------- */

async function renderDashboard() {
  const profile = await getProfile();
  const pesoActual = await ensureLatestWeight(profile);
  const imc = pesoActual / (profile.altura * profile.altura);

  const totalPerder = profile.pesoInicial - profile.pesoObjetivo;
  const perdidoHasta = profile.pesoInicial - pesoActual;
  const pct = totalPerder > 0 ? Math.min(100, Math.max(0, (perdidoHasta / totalPerder) * 100)) : 0;

  document.getElementById('dash-peso-actual').textContent = `${pesoActual.toFixed(1)} kg`;
  document.getElementById('dash-peso-objetivo').textContent = `${profile.pesoObjetivo.toFixed(1)} kg`;
  document.getElementById('dash-imc').textContent = imc.toFixed(1);
  document.getElementById('dash-progress-bar').style.width = `${pct.toFixed(0)}%`;
  document.getElementById('dash-progress-text').textContent = `${pct.toFixed(0)}% completado`;
  document.getElementById('dash-sinfumar').textContent = `${daysBetween(profile.quitSmokingDate)} días`;

  const swims = await DB.getAll('swimWorkouts');
  const totalMetros = swims.reduce((sum, s) => sum + (s.metros || 0), 0);
  document.getElementById('dash-km').textContent = `${(totalMetros / 1000).toFixed(1)} km`;

  // Racha: días consecutivos con al menos un registro (peso o salud) hasta hoy
  const weightDates = new Set((await DB.getAll('weightLogs')).map((w) => w.date));
  const healthDates = new Set((await DB.getAll('healthLogs')).map((h) => h.date));
  let racha = 0;
  let cursor = new Date();
  while (true) {
    const ds = cursor.toISOString().slice(0, 10);
    if (weightDates.has(ds) || healthDates.has(ds)) {
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  document.getElementById('dash-racha').textContent = `${racha} días`;

  const logs = (await DB.getAll('weightLogs')).sort((a, b) => a.date.localeCompare(b.date));
  renderLineChart('chart-dashboard-weight', logs.map((l) => l.date.slice(5)), logs.map((l) => l.peso), 'Peso (kg)');
}

/* ---------------- NUTRICIÓN ---------------- */

async function renderNutricion() {
  const today = todayStr();
  const water = (await DB.getAll('water')).filter((w) => w.date === today);
  const beers = (await DB.getAll('beers')).filter((b) => b.date === today);
  document.getElementById('nutri-agua-hoy').textContent = water.length;
  document.getElementById('nutri-cervezas-hoy').textContent = beers.length;
}

/* ---------------- NATACIÓN ---------------- */

const SWIM_PLAN = {
  1: 'Resistencia',
  2: 'Técnica + respiración',
  3: 'Resistencia',
  4: 'Descanso o paseo',
  5: 'Series',
  6: 'Tirada larga',
  0: 'Descanso activo'
};

async function renderNatacion() {
  document.getElementById('swim-plan-hoy').textContent = SWIM_PLAN[new Date().getDay()];

  const swims = (await DB.getAll('swimWorkouts')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const container = document.getElementById('swim-historial');
  if (!swims.length) {
    container.innerHTML = '<div class="placeholder">Sin sesiones registradas todavía.</div>';
    return;
  }
  container.innerHTML = swims.map((s) => `
    <div class="row">
      <span>${s.tipo.replace('_', ' ')}</span>
      <span class="muted">${s.metros} m · ${s.date}</span>
    </div>
  `).join('');
}

/* ---------------- CALISTENIA ---------------- */

async function renderCalistenia() {
  const items = (await DB.getAll('calisthenicsWorkouts')).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const container = document.getElementById('cal-historial');
  if (!items.length) {
    container.innerHTML = '<div class="placeholder">Sin registros todavía.</div>';
    return;
  }
  container.innerHTML = items.map((i) => `
    <div class="row">
      <span>${i.ejercicio}</span>
      <span class="muted">${i.reps} · ${i.date}</span>
    </div>
  `).join('');
}

/* ---------------- ESTADÍSTICAS ---------------- */

async function renderEstadisticas() {
  const weights = (await DB.getAll('weightLogs')).sort((a, b) => a.date.localeCompare(b.date));
  renderLineChart('chart-stats-weight', weights.map((w) => w.date.slice(5)), weights.map((w) => w.peso), 'Peso (kg)');

  const health = (await DB.getAll('healthLogs')).sort((a, b) => a.date.localeCompare(b.date)).filter((h) => h.cintura);
  renderLineChart('chart-stats-waist', health.map((h) => h.date.slice(5)), health.map((h) => h.cintura), 'Cintura (cm)', '#fbbf24');

  const swims = (await DB.getAll('swimWorkouts')).sort((a, b) => a.date.localeCompare(b.date));
  let acc = 0;
  const swimLabels = [], swimData = [];
  swims.forEach((s) => {
    acc += (s.metros || 0) / 1000;
    swimLabels.push(s.date.slice(5));
    swimData.push(Number(acc.toFixed(2)));
  });
  renderLineChart('chart-stats-swim', swimLabels, swimData, 'km acumulados', '#4ade80');
}

/* ---------------- EVENTOS ---------------- */

function wireEvents() {

  document.getElementById('btn-guardar-peso-rapido').addEventListener('click', async () => {
    const val = parseFloat(document.getElementById('input-peso-rapido').value);
    if (!val) return showToast('Introduce un peso válido');
    await DB.add('weightLogs', { date: todayStr(), peso: val });
    document.getElementById('input-peso-rapido').value = '';
    showToast('Peso guardado');
    await renderDashboard();
    await checkAchievementsNow();
  });

  document.getElementById('btn-add-agua').addEventListener('click', async () => {
    await DB.add('water', { date: todayStr(), ts: Date.now() });
    await renderNutricion();
  });

  document.getElementById('btn-add-cerveza').addEventListener('click', async () => {
    await DB.add('beers', { date: todayStr(), ts: Date.now() });
    await renderNutricion();
  });

  document.getElementById('btn-guardar-swim').addEventListener('click', async () => {
    const metros = parseInt(document.getElementById('input-swim-metros').value, 10);
    const tipo = document.getElementById('input-swim-tipo').value;
    if (!metros) return showToast('Introduce los metros nadados');
    await DB.add('swimWorkouts', { date: todayStr(), metros, tipo });
    document.getElementById('input-swim-metros').value = '';
    showToast('Entrenamiento guardado');
    await Gamification.addXP(Math.round((metros / 1000) * Gamification.rules.KM_NADADO), 'Natación');
    await renderNatacion();
    await renderDashboard();
    await checkAchievementsNow();
    updateLevelBadge();
  });

  document.getElementById('btn-guardar-cal').addEventListener('click', async () => {
    const ejercicio = document.getElementById('input-cal-ejercicio').value;
    const reps = document.getElementById('input-cal-reps').value;
    if (!reps) return showToast('Introduce las repeticiones');
    await DB.add('calisthenicsWorkouts', { date: todayStr(), ejercicio, reps });
    document.getElementById('input-cal-reps').value = '';
    showToast('Registro guardado');
    await Gamification.addXP(Gamification.rules.ENTRENO_CALISTENIA, 'Calistenia');
    await renderCalistenia();
    await checkAchievementsNow();
    updateLevelBadge();
  });

  document.getElementById('btn-guardar-salud').addEventListener('click', async () => {
    const entry = {
      date: todayStr(),
      cintura: parseFloat(document.getElementById('input-cintura').value) || null,
      sueno: parseFloat(document.getElementById('input-sueno').value) || null,
      animo: parseInt(document.getElementById('input-animo').value, 10) || null,
      lumbar: parseInt(document.getElementById('input-lumbar').value, 10) || null,
      hombro: parseInt(document.getElementById('input-hombro').value, 10) || null
    };
    await DB.add('healthLogs', entry);
    ['input-cintura', 'input-sueno', 'input-animo', 'input-lumbar', 'input-hombro'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    showToast('Registro de salud guardado');
    if (entry.sueno >= 7) await Gamification.addXP(Gamification.rules.SUENO_7H, 'Sueño');
    await renderDashboard();
    updateLevelBadge();
  });

  document.getElementById('btn-export').addEventListener('click', async () => {
    const dump = await DB.exportAll();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oscarfit78-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Copia de seguridad exportada');
  });

  document.getElementById('btn-import').addEventListener('click', async () => {
    const fileInput = document.getElementById('input-import');
    const file = fileInput.files[0];
    if (!file) return showToast('Selecciona un archivo primero');
    const text = await file.text();
    try {
      const dump = JSON.parse(text);
      await DB.importAll(dump);
      showToast('Datos importados correctamente');
      await refreshAll();
    } catch (e) {
      showToast('Archivo no válido');
    }
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (!confirm('¿Seguro que quieres borrar todos los datos? Esta acción no se puede deshacer.')) return;
    for (const store of DB.STORES) {
      await DB.clear(store.name);
    }
    showToast('Todos los datos han sido borrados');
    await refreshAll();
  });

  document.addEventListener('section:change', (e) => {
    const section = e.detail.section;
    if (section === 'dashboard') renderDashboard();
    if (section === 'nutricion') renderNutricion();
    if (section === 'natacion') renderNatacion();
    if (section === 'calistenia') renderCalistenia();
    if (section === 'estadisticas') renderEstadisticas();
  });

  document.addEventListener('xp:gained', (e) => {
    if (e.detail.leveledUp) showToast(`¡Subes a nivel ${e.detail.state.level}! 🎉`);
  });

  document.addEventListener('achievements:unlocked', (e) => {
    e.detail.unlocked.forEach((a) => showToast(`🏆 Logro desbloqueado: ${a.label}`));
  });
}

async function checkAchievementsNow() {
  const weights = await DB.getAll('weightLogs');
  const profile = await getProfile();
  const pesoActual = weights.length ? weights.sort((a, b) => b.date.localeCompare(a.date))[0].peso : profile.pesoInicial;
  const swims = await DB.getAll('swimWorkouts');
  const totalKm = swims.reduce((s, w) => s + (w.metros || 0), 0) / 1000;
  const cal = await DB.getAll('calisthenicsWorkouts');
  const totalFlexiones = cal.filter((c) => c.ejercicio === 'Flexiones')
    .reduce((s, c) => s + (parseInt(c.reps, 10) || 0), 0);

  await Gamification.checkAchievements({
    totalKm,
    diasSinFumar: daysBetween(profile.quitSmokingDate),
    totalFlexiones,
    kgPerdidos: profile.pesoInicial - pesoActual
  });
}

async function updateLevelBadge() {
  const state = await Gamification.getState();
  document.getElementById('level-label').textContent = `Nivel ${state.level}`;
}

async function refreshAll() {
  await renderDashboard();
  await renderNutricion();
  await renderNatacion();
  await renderCalistenia();
  await renderEstadisticas();
  await updateLevelBadge();
}

/* ---------------- INIT ---------------- */

document.addEventListener('DOMContentLoaded', async () => {
  await getProfile();
  Router.init();
  wireEvents();
  await refreshAll();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
