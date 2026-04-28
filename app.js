
const state = {
  token: '',
  agent: null,
  currentCitizen: null,
  currentReport: null,
  currentView: 'dashboard'
};

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const agentName = document.getElementById('agentName');
const agentMeta = document.getElementById('agentMeta');
const stats = document.getElementById('stats');
const auditPreview = document.getElementById('auditPreview');
const auditList = document.getElementById('auditList');
const logoutBtn = document.getElementById('logoutBtn');
const auditPdfBtn = document.getElementById('auditPdfBtn');
const citizenSearch = document.getElementById('citizenSearch');
const citizenSearchBtn = document.getElementById('citizenSearchBtn');
const citizenList = document.getElementById('citizenList');
const citizenProfile = document.getElementById('citizenProfile');
const citizenPdfBtn = document.getElementById('citizenPdfBtn');
const fineForm = document.getElementById('fineForm');
const fineMsg = document.getElementById('fineMsg');
const finesList = document.getElementById('finesList');
const globalSearch = document.getElementById('globalSearch');
const statusFilter = document.getElementById('statusFilter');
const reportsList = document.getElementById('reportsList');
const reportDetail = document.getElementById('reportDetail');
const reportSearch = document.getElementById('reportSearch');
const reportSearchBtn = document.getElementById('reportSearchBtn');
const reportDialog = document.getElementById('reportDialog');
const reportForm = document.getElementById('reportForm');
const openReportForm = document.getElementById('openReportForm');
const closeReportDialog = document.getElementById('closeReportDialog');
const refreshAuditBtn = document.getElementById('refreshAuditBtn');

function getCookie(name) {
  return document.cookie.split('; ').find(r => r.startsWith(`${name}=`))?.split('=')[1] || '';
}

function api(path, options = {}) {
  const token = getCookie('mvpd_token');
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  }).then(async res => {
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  });
}

async function track(action, detail = '', meta = {}) {
  try {
    await api('/api/audit/client', { method: 'POST', body: JSON.stringify({ action, detail, meta }) });
  } catch {}
}

function showView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.module-card').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  track('switch_view', `Entró en la sección ${view}`);
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
}

async function boot() {
  try {
    const me = await api('/api/me');
    state.agent = me.agent;
    agentName.textContent = me.agent.displayName;
    agentMeta.textContent = `Discord ID: ${me.agent.discordId} · usuario: ${me.agent.username}`;
    showApp();
    await Promise.all([loadDashboard(), loadCitizens(), refreshFines(), loadReports(), loadAudit()]);
  } catch {
    showLogin();
  }
}

async function loadDashboard() {
  const data = await api('/api/dashboard');
  stats.innerHTML = [
    ['Ciudadanos', data.counts.citizens],
    ['Multas', data.counts.fines],
    ['Pendientes', data.counts.pendingFines],
    ['Informes', data.counts.reports]
  ].map(([label, value]) => `<div class="stat"><span class="meta">${label}</span><strong>${value}</strong></div>`).join('');
  auditPreview.innerHTML = data.latestAudit.length ? data.latestAudit.map(renderAudit).join('') : '<div class="card">Sin actividad reciente.</div>';
}

function renderAudit(item) {
  return `<article class="audit-item"><strong>${item.action}</strong><div class="meta">${item.actor?.displayName || 'Desconocido'} · ${new Date(item.createdAt).toLocaleString('es-ES')}</div><div>${item.detail || ''}</div></article>`;
}

async function loadAudit() {
  const data = await api('/api/audit');
  auditList.innerHTML = data.audit.length ? data.audit.map(renderAudit).join('') : '<div class="card">Sin eventos.</div>';
}

async function loadCitizens() {
  const data = await api(`/api/citizens?q=${encodeURIComponent(citizenSearch.value.trim())}`);
  citizenList.innerHTML = data.citizens.length ? data.citizens.map(c => `
    <article class="citizen-row" data-dni="${c.dni}">
      <strong>${c.name} ${c.surname}</strong>
      <div class="meta">${c.dni} · ${c.phone || '-'} · ${c.profession || '-'}</div>
    </article>`).join('') : '<div class="card">Sin resultados.</div>';
  document.querySelectorAll('.citizen-row').forEach(row => row.addEventListener('click', () => openCitizen(row.dataset.dni)));
}

function renderNote(note) {
  return `<div class="card"><strong>${note.title}</strong><div>${note.text}</div><div class="meta">${note.author} · ${new Date(note.createdAt).toLocaleString('es-ES')}</div></div>`;
}

function renderCitizenProfile(data) {
  const c = data.citizen;
  citizenProfile.innerHTML = `
    <div class="citizen-detail-grid">
      <div class="card"><h4>${c.name} ${c.surname}</h4><div class="meta">DNI: ${c.dni}</div><div class="meta">Teléfono: ${c.phone || '-'}</div><div class="meta">Banco: ${c.bank || '-'}</div><div class="badges" style="margin-top:10px"><span class="badge ${c.wanted ? 'pending' : 'paid'}">Busca y captura: ${c.wanted ? 'Sí' : 'No'}</span><span class="badge ${c.dangerous ? 'pending' : 'paid'}">Peligroso: ${c.dangerous ? 'Sí' : 'No'}</span><span class="badge paid">Pendiente: ${data.totalPending} €</span></div></div>
      <div class="card"><h4>Perfil</h4><div class="meta">Nacimiento: ${c.birthDate || '-'}</div><div class="meta">Nacionalidad: ${c.nationality || '-'}</div><div class="meta">Trabajo: ${c.profession || '-'}</div><div class="meta">Sexo: ${c.sex || '-'}</div></div>
      <div class="card"><div class="section-header"><h4>Notas</h4></div>
        <form id="noteForm" class="mini-list">
          <input name="title" placeholder="Título de la nota" required />
          <textarea name="text" rows="3" placeholder="Texto de la nota" required></textarea>
          <div class="row end"><button class="primary">Guardar nota</button></div>
        </form>
        <div class="mini-list" id="notesList">${(c.notes || []).length ? c.notes.map(renderNote).join('') : '<div class="meta">No hay notas registradas.</div>'}</div>
      </div>
      <div class="card"><div class="section-header"><h4>Multas</h4></div>${data.fines.length ? data.fines.map(f => `<div class="card"><strong>#${f.id} · ${f.reason}</strong><div class="meta">${f.amount}€ · ${f.status}</div></div>`).join('') : '<div class="meta">No hay multas registradas.</div>'}</div>
      <div class="card"><div class="section-header"><h4>Denuncias / informes</h4></div>${data.reports.length ? data.reports.map(r => `<div class="card"><strong>${r.title}</strong><div class="meta">#${r.id} · ${r.location || '-'}</div></div>`).join('') : '<div class="meta">No hay informes relacionados.</div>'}</div>
      <div class="card"><div class="section-header"><h4>Licencias</h4></div>
        <form id="licenseForm" class="mini-list">
          <input name="type" placeholder="Tipo: driver, arma, negocio..." required />
          <input name="expiresAt" placeholder="Vencimiento ISO o libre" />
          <div class="row end"><button class="primary">Agregar licencia</button></div>
        </form>
        <div class="mini-list">${(c.licenses || []).length ? c.licenses.map(l => `<div class="card"><strong>${l.type}</strong><div class="meta">${l.expiresAt || 'Sin vencimiento'}</div></div>`).join('') : '<div class="meta">Sin licencias.</div>'}</div>
      </div>
    </div>`;

  document.getElementById('noteForm').addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api(`/api/citizens/${encodeURIComponent(c.dni)}/notes`, { method: 'POST', body: JSON.stringify(Object.fromEntries(form.entries())) });
    await openCitizen(c.dni);
  });
  document.getElementById('licenseForm').addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api(`/api/citizens/${encodeURIComponent(c.dni)}/licenses`, { method: 'POST', body: JSON.stringify(Object.fromEntries(form.entries())) });
    await openCitizen(c.dni);
  });
}

async function openCitizen(dni) {
  const data = await api(`/api/citizens/${encodeURIComponent(dni)}`);
  state.currentCitizen = data.citizen.dni;
  renderCitizenProfile(data);
  document.querySelectorAll('.citizen-row').forEach(row => row.classList.toggle('active', row.dataset.dni === dni));
}

fineForm.dni.addEventListener('blur', async () => {
  const dni = fineForm.dni.value.trim();
  if (!dni) return;
  try {
    const data = await api(`/api/citizens/${encodeURIComponent(dni)}`);
    ['name','surname','nationality','sex','profession','birthDate','phone','bank'].forEach(key => fineForm[key].value = data.citizen[key] || '');
    fineMsg.textContent = 'DNI encontrado. Datos autocompletados.';
  } catch {
    fineMsg.textContent = '';
  }
});

fineForm.addEventListener('submit', async e => {
  e.preventDefault();
  fineMsg.textContent = 'Guardando...';
  const data = await api('/api/fines', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(fineForm).entries())) });
  fineMsg.textContent = `Multa #${data.fine.id} guardada correctamente.`;
  fineForm.reset();
  await refreshFines();
  await loadCitizens();
  if (state.currentCitizen === data.citizen.dni) await openCitizen(data.citizen.dni);
});

function renderFine(f) {
  const citizenName = f.citizen ? `${f.citizen.name} ${f.citizen.surname}` : 'Desconocido';
  return `<article class="fine-item"><div class="fine-top"><div><strong>#${f.id} · ${f.reason}</strong><div class="meta">${citizenName} · DNI ${f.dni}</div></div><div class="badges"><span class="badge ${f.status === 'pagada' ? 'paid' : 'pending'}">${f.status}</span><span class="badge paid">${f.amount} €</span></div></div><div class="meta">Agente: ${f.agentName} · ${new Date(f.createdAt).toLocaleString('es-ES')}</div><div class="meta">${f.address || '-'}</div><div>${f.notes || ''}</div><div class="row end" style="margin-top:10px">${f.status === 'pendiente' ? `<button class="primary pay-btn" data-id="${f.id}">Marcar pagada</button>` : ''}</div></article>`;
}

async function refreshFines() {
  const data = await api(`/api/search?q=${encodeURIComponent(globalSearch.value.trim())}&status=${encodeURIComponent(statusFilter.value)}`);
  finesList.innerHTML = data.fines.length ? data.fines.map(renderFine).join('') : '<div class="card">No hay multas.</div>';
  document.querySelectorAll('.pay-btn').forEach(btn => btn.addEventListener('click', async () => {
    await api(`/api/fines/${btn.dataset.id}/pay`, { method: 'PATCH' });
    await refreshFines();
    if (state.currentCitizen) await openCitizen(state.currentCitizen);
  }));
}

function renderReportItem(r) {
  return `<article class="report-item" data-id="${r.id}"><strong>${r.title} #${r.id}</strong><div class="meta">${r.location || '-'} · ${new Date(r.createdAt).toLocaleString('es-ES')}</div><div class="badges">${(r.tags || []).map(tag => `<span class="badge">${tag}</span>`).join('')}</div></article>`;
}

function renderReportDetail(report) {
  reportDetail.innerHTML = `
    <div class="report-detail-grid">
      <div class="card"><h4>${report.title}</h4><div class="meta">#${report.id} · ${new Date(report.createdAt).toLocaleString('es-ES')}</div><div>${report.description}</div></div>
      <div class="card"><h4>Datos</h4><div class="meta">Localización: ${report.location || '-'}</div><div class="meta">Creado por: ${report.createdBy}</div><div class="badges" style="margin-top:10px">${(report.tags || []).map(tag => `<span class="badge">${tag}</span>`).join('') || '<span class="meta">Sin tags</span>'}</div></div>
      <div class="card"><h4>Agentes involucrados</h4>${(report.officers || []).length ? report.officers.map(o => `<div class="card">${o.name}${o.badge ? ` (${o.badge})` : ''}</div>`).join('') : '<div class="meta">Sin agentes.</div>'}</div>
      <div class="card"><h4>Víctimas / personas</h4>${(report.victims || []).length ? report.victims.map(v => `<div class="card">${v}</div>`).join('') : '<div class="meta">Sin víctimas.</div>'}${(report.citizens || []).length ? `<div class="meta" style="margin-top:10px">DNIs: ${report.citizens.join(', ')}</div>` : ''}</div>
      <div class="card"><h4>Vehículos</h4>${(report.vehicles || []).length ? report.vehicles.map(v => `<div class="card">${v}</div>`).join('') : '<div class="meta">Sin vehículos.</div>'}</div>
      <div class="card"><h4>Evidencias</h4>${(report.evidences || []).length ? report.evidences.map(ev => `<div class="card">${ev}</div>`).join('') : '<div class="meta">Sin evidencias.</div>'}</div>
    </div>`;
}

async function loadReports() {
  const data = await api(`/api/reports?q=${encodeURIComponent(reportSearch.value.trim())}`);
  reportsList.innerHTML = data.reports.length ? data.reports.map(renderReportItem).join('') : '<div class="card">No hay informes.</div>';
  document.querySelectorAll('.report-item').forEach(item => item.addEventListener('click', async () => {
    const data = await api(`/api/reports/${item.dataset.id}`);
    state.currentReport = data.report.id;
    renderReportDetail(data.report);
  }));
}

logoutBtn.addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  location.reload();
});

auditPdfBtn.addEventListener('click', () => window.open('/api/audit/pdf', '_blank'));
refreshAuditBtn.addEventListener('click', loadAudit);
citizenSearchBtn.addEventListener('click', loadCitizens);
reportSearchBtn.addEventListener('click', loadReports);
openReportForm.addEventListener('click', () => reportDialog.showModal());
closeReportDialog.addEventListener('click', () => reportDialog.close());
citizenPdfBtn.addEventListener('click', () => {
  if (!state.currentCitizen) return alert('Primero abre una ficha.');
  window.open(`/api/citizens/${encodeURIComponent(state.currentCitizen)}/pdf`, '_blank');
});
reportForm.addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(reportForm);
  const payload = {
    title: form.get('title'),
    location: form.get('location'),
    description: form.get('description'),
    tags: String(form.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean),
    officers: String(form.get('officers') || '').split(',').map(s => s.trim()).filter(Boolean).map(x => {
      const [name, badge] = x.split('|').map(v => v.trim());
      return { name, badge: badge || '' };
    }),
    victims: String(form.get('victims') || '').split(',').map(s => s.trim()).filter(Boolean),
    vehicles: String(form.get('vehicles') || '').split(',').map(s => s.trim()).filter(Boolean),
    citizens: String(form.get('citizens') || '').split(',').map(s => s.trim()).filter(Boolean),
    evidences: String(form.get('evidences') || '').split('
').map(s => s.trim()).filter(Boolean)
  };
  await api('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
  reportDialog.close();
  reportForm.reset();
  await loadReports();
});

globalSearch.addEventListener('input', refreshFines);
statusFilter.addEventListener('change', refreshFines);
document.querySelectorAll('.module-card').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

boot();

// ================= RADIO LIVEKIT =================

let room = null;
let canalActual = null;

async function entrarCanal(canal) {
  try {
    if (room) {
      room.disconnect();
      room = null;
    }

    canalActual = canal;

    const username = "Theory"; // luego lo conectamos con usuario real

    const res = await fetch(
      `/api/livekit-token?username=${encodeURIComponent(username)}&room=${encodeURIComponent(canal)}`
    );

    const data = await res.json();

    room = await LivekitClient.connect(data.url, data.token, {
      audio: false,
      video: false
    });

    room.on('trackSubscribed', (track) => {
      if (track.kind === 'audio') {
        const audio = new Audio();
        track.attach(audio);
        audio.play();
      }
    });

    console.log("Conectado a:", canal);

  } catch (err) {
    console.error("Error radio:", err);
  }
}

// PUSH TO TALK (tecla N)
document.addEventListener('keydown', async (e) => {
  if (e.key.toLowerCase() === 'n' && room) {
    await room.localParticipant.setMicrophoneEnabled(true);
  }
});

document.addEventListener('keyup', async (e) => {
  if (e.key.toLowerCase() === 'n' && room) {
    await room.localParticipant.setMicrophoneEnabled(false);
  }
});