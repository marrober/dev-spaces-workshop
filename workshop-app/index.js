const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Map external key names to our stored names
const TEXT_KEYS = {
  rosa_openshift_admin_password: 'adminPassword',
  rosa_openshift_admin_user: 'adminUser',
  rosa_openshift_console_url: 'consoleURL',
};

// All extracted credential sets (multiple drops over time)
const storedCredentials = [];

// Workshop URL (set by admin, shown on clusters page)
let workshopUrl = null;

function extractCredentials(text) {
  if (typeof text !== 'string') return {};
  const result = {};
  const raw = text;
  for (const [key, storeAs] of Object.entries(TEXT_KEYS)) {
    // Same-line value, or value on next line after :>- (YAML-style)
    const regex = new RegExp(
      `${key}\\s*[:=]\\s*(?:>-?\\s*)?(?:([^\\r\\n]+)|[\\r\\n]+\\s*([^\\r\\n]+))`,
      'i'
    );
    const m = raw.match(regex);
    if (m) {
      const sameLine = (m[1] || '').trim();
      const nextLine = (m[2] || '').trim();
      const value = nextLine || sameLine;
      if (value && value !== '>-') result[storeAs] = value;
    }
  }
  return result;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/workshop-url', (_req, res) => {
  res.json({ workshopUrl: workshopUrl ?? '' });
});

app.post('/api/admin/workshop-url', (req, res) => {
  const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
  workshopUrl = url || null;
  res.json({ workshopUrl: workshopUrl ?? '' });
});

function isDuplicateCluster(extracted) {
  const url = (extracted.consoleURL || '').trim().toLowerCase();
  if (!url) return false;
  return storedCredentials.some(
    (c) => (c.consoleURL || '').trim().toLowerCase() === url
  );
}

app.post('/api/admin/text', (req, res) => {
  const { text } = req.body ?? {};
  const extracted = extractCredentials(text);
  if (Object.keys(extracted).length === 0) {
    return res.json({
      received: true,
      extracted: [],
      totalStored: storedCredentials.length,
    });
  }
  if (isDuplicateCluster(extracted)) {
    return res.json({
      received: true,
      duplicate: true,
      extracted: Object.keys(extracted),
      totalStored: storedCredentials.length,
    });
  }
  storedCredentials.push({
    ...extracted,
    submittedAt: new Date().toISOString(),
    reservedBy: null,
  });
  res.json({
    received: true,
    extracted: Object.keys(extracted),
    totalStored: storedCredentials.length,
  });
});

app.get('/api/admin/credentials', (_req, res) => {
  res.json({ credentials: storedCredentials });
});

app.delete('/api/admin/credentials', (_req, res) => {
  storedCredentials.length = 0;
  res.json({ cleared: true });
});

app.get('/clusters', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'clusters.html'));
});

app.get('/api/clusters', (_req, res) => {
  const list = storedCredentials.map((c, i) => ({
    index: i,
    consoleURL: c.consoleURL ?? null,
    adminUser: c.adminUser ?? null,
    adminPassword: c.adminPassword ?? null,
    reservedBy: c.reservedBy ?? null,
  }));
  res.json({ clusters: list, workshopUrl: workshopUrl ?? '' });
});

app.post('/api/clusters/:index/reserve', (req, res) => {
  const index = parseInt(req.params.index, 10);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (Number.isNaN(index) || index < 0 || index >= storedCredentials.length) {
    return res.status(400).json({ error: 'Invalid cluster index' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  storedCredentials[index].reservedBy = name;
  res.json({ reserved: true, index, reservedBy: name });
});

// Allocate first unallocated cluster to the given name (atomic, no double-allocation)
app.post('/api/clusters/reserve', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const index = storedCredentials.findIndex((c) => !c.reservedBy || c.reservedBy === '');
  if (index === -1) {
    return res.status(409).json({ error: 'No clusters available' });
  }
  storedCredentials[index].reservedBy = name;
  res.json({
    reserved: true,
    index,
    clusterNumber: index + 1,
    reservedBy: name,
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
