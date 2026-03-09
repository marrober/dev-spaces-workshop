const listEl = document.getElementById('clusters-list');
const statusEl = document.getElementById('clusters-status');
const nameFormEl = document.getElementById('clusters-name-form');
const nameInputEl = document.getElementById('clusters-name-input');
const nameReserveBtn = document.getElementById('clusters-name-reserve');
const nameDisplayEl = document.getElementById('clusters-name-display');
const nameReadonlyEl = document.getElementById('clusters-name-readonly');

const SESSION_NAME_KEY = 'clusters-reserved-name';
const SESSION_CLUSTER_KEY = 'clusters-reserved-cluster';

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'clusters-status' + (type ? ` ${type}` : '');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function workshopUrlFromConsole(consoleURL) {
  if (!consoleURL || typeof consoleURL !== 'string') return '';
  const lower = consoleURL.trim().toLowerCase();
  const idx = lower.indexOf('apps.');
  if (idx === -1) return '';
  const fromApps = consoleURL.trim().substring(idx);
  const pathStart = fromApps.indexOf('/');
  return pathStart === -1 ? fromApps : fromApps.substring(0, pathStart);
}

function copyToClipboard(text, buttonEl) {
  if (!text) return false;
  const label = buttonEl?.textContent;
  navigator.clipboard.writeText(text).then(() => {
    if (buttonEl) {
      buttonEl.textContent = 'Copied!';
      setTimeout(() => { buttonEl.textContent = label; }, 1500);
    }
  }).catch(() => false);
}

function buildClusterWorkshopUrl(workshopBaseUrl, clusterSubdomain) {
  const base = (workshopBaseUrl || '').trim();
  if (!base || !/^https?:\/\//i.test(base) || !clusterSubdomain) return '';
  const sep = base.includes('?') ? '&' : '?';
  return base + sep + 'CLUSTER_SUBDOMAIN=' + encodeURIComponent(clusterSubdomain) + '&PROJECT=openshift-operators';
}

function renderClusters(clusters, workshopBaseUrl) {
  if (!clusters.length) {
    listEl.innerHTML = '<li class="clusters-empty">No clusters available yet.</li>';
    return;
  }
  listEl.innerHTML = clusters.map((c, i) => {
    const clusterNum = i + 1;
    const title = `Cluster ${clusterNum}`;
    const adminUser = c.adminUser != null ? escapeHtml(c.adminUser) : '';
    const consoleURL = c.consoleURL != null ? c.consoleURL : '';
    const adminPassword = c.adminPassword != null ? c.adminPassword : '';
    const hasConsole = /^https?:\/\//i.test(consoleURL);
    const isReserved = !!c.reservedBy;
    const reservedLine = c.reservedBy
      ? `<p class="cluster-reserved">Reserved by: <span class="cluster-reserved-name">${escapeHtml(c.reservedBy)}</span></p>`
      : '';
    const workshopUrlPart = workshopUrlFromConsole(consoleURL);
    const clusterWorkshopUrl = buildClusterWorkshopUrl(workshopBaseUrl, workshopUrlPart);
    const hasClusterWorkshop = !!clusterWorkshopUrl;
    const actionsDisabled = isReserved ? '' : ' cluster-actions--disabled';
    const details = [];
    if (c.adminUser != null) details.push(`<div class="cluster-credential-line"><span class="cluster-credential-label">Admin user:</span> ${adminUser}</div>`);
    if (workshopUrlPart) details.push(`<div class="cluster-workshop-url-row"><span class="cluster-credential-label">Cluster URL for workshop</span><input type="text" class="cluster-workshop-url-field" value="${escapeAttr(workshopUrlPart)}" readonly /></div>`);
    const workshopBtn = hasClusterWorkshop && isReserved
      ? `<a href="${escapeAttr(clusterWorkshopUrl)}" target="_blank" rel="noopener" class="cluster-btn cluster-btn-secondary">Workshop</a>`
      : `<span class="cluster-btn cluster-btn-secondary cluster-btn-disabled">Workshop</span>`;
    details.push(`<div class="cluster-actions${actionsDisabled}" data-reserved="${isReserved}">
      ${hasConsole ? (isReserved ? `<a href="${escapeAttr(consoleURL)}" target="_blank" rel="noopener" class="cluster-btn cluster-btn-secondary">Launch OpenShift console</a>` : `<span class="cluster-btn cluster-btn-secondary cluster-btn-disabled">Launch OpenShift console</span>`) : ''}
      ${consoleURL ? `<button type="button" class="cluster-btn cluster-btn-secondary" data-copy-url="${escapeAttr(consoleURL)}" ${isReserved ? '' : 'disabled'}>Copy cluster URL</button>` : ''}
      ${adminPassword ? `<button type="button" class="cluster-btn cluster-btn-secondary" data-copy-password="${escapeAttr(adminPassword)}" ${isReserved ? '' : 'disabled'}>Copy admin password</button>` : ''}
      ${workshopBtn}
    </div>`);
    return `<li>
      <h2 class="cluster-title">${title}</h2>
      ${reservedLine}
      ${details.join('')}
    </li>`;
  }).join('');

  listEl.querySelectorAll('[data-copy-url]').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copyUrl, btn));
  });
  listEl.querySelectorAll('[data-copy-password]').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copyPassword, btn));
  });
}

const workshopEl = document.getElementById('clusters-workshop');

function updateNameSection() {
  const name = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_NAME_KEY) : null;
  if (name && nameDisplayEl && nameFormEl && nameReadonlyEl) {
    nameReadonlyEl.value = name;
    nameFormEl.style.display = 'none';
    nameDisplayEl.style.display = 'flex';
  } else if (nameFormEl && nameDisplayEl) {
    nameFormEl.style.display = 'flex';
    nameDisplayEl.style.display = 'none';
  }
}

async function reserveFirstCluster() {
  const name = nameInputEl?.value?.trim();
  if (!name) {
    setStatus('Please enter your name.', 'error');
    return;
  }
  setStatus('Reserving…');
  try {
    const res = await fetch('/api/clusters/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok && data.reserved) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_NAME_KEY, name);
        if (data.clusterNumber != null) sessionStorage.setItem(SESSION_CLUSTER_KEY, String(data.clusterNumber));
      }
      if (nameReadonlyEl) nameReadonlyEl.value = name;
      if (nameFormEl) nameFormEl.style.display = 'none';
      if (nameDisplayEl) nameDisplayEl.style.display = 'flex';
      setStatus(`Cluster ${data.clusterNumber || data.index + 1} allocated to you.`, 'success');
      loadClusters();
    } else {
      setStatus(data.error || 'Reserve failed.', 'error');
    }
  } catch {
    setStatus('Network error.', 'error');
  }
}

function renderWorkshopButton(workshopUrl) {
  if (!workshopEl) return;
  const url = (workshopUrl || '').trim();
  const hasUrl = url && /^https?:\/\//i.test(url);
  if (hasUrl) {
    workshopEl.innerHTML = `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="clusters-workshop-btn">Workshop URL</a>`;
  } else {
    workshopEl.innerHTML = `<span class="clusters-workshop-btn clusters-workshop-btn--disabled" aria-disabled="true">Workshop URL</span>`;
  }
  workshopEl.style.display = 'block';
}

async function loadClusters() {
  try {
    const res = await fetch('/api/clusters');
    const data = await res.json();
    if (res.ok) {
      renderClusters(data.clusters || [], data.workshopUrl);
      renderWorkshopButton(data.workshopUrl);
      updateNameSection();
      setStatus('');
    } else {
      listEl.innerHTML = '';
      renderWorkshopButton('');
      setStatus('Failed to load clusters.', 'error');
    }
  } catch {
    listEl.innerHTML = '';
    renderWorkshopButton('');
    setStatus('Network error.', 'error');
  }
}

if (nameReserveBtn) nameReserveBtn.addEventListener('click', reserveFirstCluster);
updateNameSection();
renderWorkshopButton(''); // show disabled until API returns
loadClusters();
