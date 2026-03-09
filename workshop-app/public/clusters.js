const listEl = document.getElementById('clusters-list');
const statusEl = document.getElementById('clusters-status');

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

function renderClusters(clusters) {
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
    const reserveForm = c.reservedBy
      ? `<p class="cluster-reserved">Reserved by: ${escapeHtml(c.reservedBy)}</p>`
      : `<form class="cluster-reserve-form" data-index="${i}" aria-label="Reserve ${title}">
           <input type="text" name="name" placeholder="Your name" required />
           <button type="submit">Reserve</button>
         </form>`;
    const workshopUrlPart = workshopUrlFromConsole(consoleURL);
    const actionsDisabled = isReserved ? '' : ' cluster-actions--disabled';
    const details = [];
    if (c.adminUser != null) details.push(`<div class="cluster-credential-line"><span class="cluster-credential-label">adminUser:</span> ${adminUser}</div>`);
    if (workshopUrlPart) details.push(`<div class="cluster-workshop-url-row"><span class="cluster-credential-label">Cluster URL for workshop</span><input type="text" class="cluster-workshop-url-field" value="${escapeAttr(workshopUrlPart)}" readonly /></div>`);
    details.push(`<div class="cluster-actions${actionsDisabled}" data-reserved="${isReserved}">
      ${hasConsole ? (isReserved ? `<a href="${escapeAttr(consoleURL)}" target="_blank" rel="noopener" class="cluster-btn cluster-btn-primary">Launch OpenShift console</a>` : `<span class="cluster-btn cluster-btn-primary cluster-btn-disabled">Launch OpenShift console</span>`) : ''}
      ${consoleURL ? `<button type="button" class="cluster-btn cluster-btn-secondary" data-copy-url="${escapeAttr(consoleURL)}" ${isReserved ? '' : 'disabled'}>Copy cluster URL</button>` : ''}
      ${adminPassword ? `<button type="button" class="cluster-btn cluster-btn-secondary" data-copy-password="${escapeAttr(adminPassword)}" ${isReserved ? '' : 'disabled'}>Copy admin password</button>` : ''}
    </div>`);
    return `<li>
      <h2 class="cluster-title">${title}</h2>
      ${reserveForm}
      ${details.join('')}
    </li>`;
  }).join('');

  listEl.querySelectorAll('[data-copy-url]').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copyUrl, btn));
  });
  listEl.querySelectorAll('[data-copy-password]').forEach((btn) => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copyPassword, btn));
  });

  listEl.querySelectorAll('.cluster-reserve-form').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const index = parseInt(form.dataset.index, 10);
      const name = form.querySelector('input[name="name"]').value.trim();
      if (!name) return;
      setStatus('Reserving…');
      try {
        const res = await fetch(`/api/clusters/${index}/reserve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (res.ok && data.reserved) {
          setStatus(`Cluster ${index + 1} reserved by ${escapeHtml(name)}.`, 'success');
          loadClusters();
        } else {
          setStatus(data.error || 'Reserve failed.', 'error');
        }
      } catch {
        setStatus('Network error.', 'error');
      }
    });
  });
}

const workshopEl = document.getElementById('clusters-workshop');

function renderWorkshopButton(workshopUrl) {
  if (!workshopEl) return;
  const url = (workshopUrl || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    workshopEl.style.display = 'none';
    workshopEl.innerHTML = '';
    return;
  }
  workshopEl.innerHTML = `<a href="${escapeAttr(url)}" target="_blank" rel="noopener" class="clusters-workshop-btn">Workshop URL</a>`;
  workshopEl.style.display = 'block';
}

async function loadClusters() {
  try {
    const res = await fetch('/api/clusters');
    const data = await res.json();
    if (res.ok) {
      renderClusters(data.clusters || []);
      renderWorkshopButton(data.workshopUrl);
      setStatus('');
    } else {
      listEl.innerHTML = '';
      workshopEl && (workshopEl.style.display = 'none');
      setStatus('Failed to load clusters.', 'error');
    }
  } catch {
    listEl.innerHTML = '';
    workshopEl && (workshopEl.style.display = 'none');
    setStatus('Network error.', 'error');
  }
}

loadClusters();
