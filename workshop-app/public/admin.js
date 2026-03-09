const form = document.getElementById('admin-form');
const textarea = document.getElementById('admin-text');
const clearBtn = document.getElementById('admin-clear');
const statusEl = document.getElementById('admin-status');
const countEl = document.getElementById('admin-credential-count');
const summaryEl = document.getElementById('admin-credential-summary');
const clearStoredBtn = document.getElementById('admin-clear-stored');
const exportCredentialsBtn = document.getElementById('admin-export-credentials');
const workshopUrlInput = document.getElementById('admin-workshop-url');
const workshopSaveBtn = document.getElementById('admin-workshop-save');
const exportOverlay = document.getElementById('admin-export-overlay');
const exportContent = document.getElementById('admin-export-content');
const exportCopyBtn = document.getElementById('admin-export-copy');
const exportCloseBtn = document.getElementById('admin-export-close');

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'admin-status' + (type ? ` ${type}` : '');
}

function renderSummary(credentials) {
  const n = credentials.length;
  countEl.textContent = `${n} credential set(s) imported`;
  if (n === 0) {
    summaryEl.textContent = '';
    return;
  }
  const parts = credentials.map((set, i) => {
    const lines = [];
    if (set.adminUser != null) lines.push(`<span class="label">Admin user:</span> ${escapeHtml(set.adminUser)}`);
    if (set.adminPassword != null) lines.push(`<span class="label">Admin user password:</span> <span class="credential-password-value" data-password="${escapeAttr(set.adminPassword)}">${'•'.repeat(8)}</span> <button type="button" class="admin-reveal-password">Reveal</button>`);
    if (set.consoleURL != null) {
      const url = escapeHtml(set.consoleURL);
      const safeHref = /^https?:\/\//i.test(set.consoleURL) ? set.consoleURL : '';
      lines.push(`<span class="label">Console URL:</span> ${safeHref ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener">${url}</a>` : url}`);
    }
    if (set.reservedBy != null) lines.push(`<span class="label">Reserved by:</span> ${escapeHtml(set.reservedBy)}`);
    if (!lines.length) return '';
    return `<div class="credential-set">${lines.map(l => `<div class="credential-line">${l}</div>`).join('')}</div>`;
  });
  summaryEl.innerHTML = parts.join('');

  summaryEl.querySelectorAll('.admin-reveal-password').forEach((btn) => {
    const valueEl = btn.previousElementSibling;
    if (!valueEl || !valueEl.classList.contains('credential-password-value')) return;
    const masked = '••••••••';
    btn.addEventListener('click', () => {
      const pwd = valueEl.dataset.password || '';
      if (valueEl.textContent === masked) {
        valueEl.textContent = pwd;
        btn.textContent = 'Hide';
      } else {
        valueEl.textContent = masked;
        btn.textContent = 'Reveal';
      }
    });
  });
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

async function loadCredentials() {
  try {
    const res = await fetch('/api/admin/credentials');
    const data = await res.json();
    if (res.ok && data.credentials) renderSummary(data.credentials);
  } catch {
    renderSummary([]);
  }
}

async function loadWorkshopUrl() {
  try {
    const res = await fetch('/api/admin/workshop-url');
    const data = await res.json();
    if (res.ok && workshopUrlInput) workshopUrlInput.value = data.workshopUrl || '';
  } catch {
    if (workshopUrlInput) workshopUrlInput.value = '';
  }
}

function formatCredentialsAsText(credentials) {
  if (!credentials || !credentials.length) return 'No credentials stored.';
  return credentials.map((c, i) => {
    const lines = [
      `Cluster ${i + 1}`,
      ...(c.adminUser != null ? [`  adminUser: ${c.adminUser}`] : []),
      ...(c.adminPassword != null ? [`  adminPassword: ${c.adminPassword}`] : []),
      ...(c.consoleURL != null ? [`  consoleURL: ${c.consoleURL}`] : []),
      ...(c.reservedBy != null ? [`  reservedBy: ${c.reservedBy}`] : []),
    ];
    return lines.join('\n');
  }).join('\n\n');
}

function showExportModal(text) {
  if (exportContent) exportContent.textContent = text;
  if (exportOverlay) {
    exportOverlay.hidden = false;
  }
}

function hideExportModal() {
  if (exportOverlay) exportOverlay.hidden = true;
}

async function openExportModal() {
  try {
    const res = await fetch('/api/admin/credentials');
    const data = await res.json();
    const text = formatCredentialsAsText(data.credentials || []);
    showExportModal(text);
  } catch {
    showExportModal('Failed to load credentials.');
  }
}

async function copyExportToClipboard() {
  if (!exportContent || !exportContent.textContent) return;
  try {
    await navigator.clipboard.writeText(exportContent.textContent);
    if (exportCopyBtn) {
      const label = exportCopyBtn.textContent;
      exportCopyBtn.textContent = 'Copied!';
      setTimeout(() => { exportCopyBtn.textContent = label; }, 1500);
    }
  } catch {
    setStatus('Copy failed.', 'error');
  }
}

async function saveWorkshopUrl() {
  const url = workshopUrlInput?.value?.trim() || '';
  try {
    const res = await fetch('/api/admin/workshop-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (res.ok) setStatus('Workshop URL saved.', 'success');
    else setStatus('Failed to save workshop URL.', 'error');
  } catch {
    setStatus('Network error.', 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = textarea.value.trim();
  setStatus('Sending…');

  try {
    const res = await fetch('/api/admin/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (res.ok && data.received) {
      if (data.duplicate) {
        alert('This cluster has already been imported. The same console URL is already stored.');
        setStatus('Duplicate cluster not imported (console URL already exists).', 'error');
        loadCredentials();
        return;
      }
      const parts = [];
      if (data.extracted && data.extracted.length) {
        parts.push(`Stored: ${data.extracted.join(', ')}`);
      } else {
        parts.push('No known credentials found in text');
      }
      if (data.totalStored != null) parts.push(`(${data.totalStored} total stored)`);
      setStatus(parts.join(' '), data.extracted?.length ? 'success' : '');
      loadCredentials();
    } else {
      setStatus('Submission failed.', 'error');
    }
  } catch {
    setStatus('Network error.', 'error');
  }
});

clearBtn.addEventListener('click', () => {
  textarea.value = '';
  setStatus('');
  textarea.focus();
});

clearStoredBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all stored credentials? This cannot be undone.')) {
    return;
  }
  try {
    const res = await fetch('/api/admin/credentials', { method: 'DELETE' });
    if (res.ok) {
      loadCredentials();
      setStatus('Stored credentials cleared. Ready for restart.', 'success');
    } else {
      setStatus('Failed to clear stored credentials.', 'error');
    }
  } catch {
    setStatus('Network error.', 'error');
  }
});

loadCredentials();
loadWorkshopUrl();

if (workshopSaveBtn) workshopSaveBtn.addEventListener('click', saveWorkshopUrl);
if (exportCredentialsBtn) exportCredentialsBtn.addEventListener('click', openExportModal);
if (exportCopyBtn) exportCopyBtn.addEventListener('click', copyExportToClipboard);
if (exportCloseBtn) exportCloseBtn.addEventListener('click', hideExportModal);
if (exportOverlay) {
  exportOverlay.addEventListener('click', (e) => {
    if (e.target === exportOverlay) hideExportModal();
  });
}
