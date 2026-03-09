const el = document.getElementById('health-status');

fetch('/api/health')
  .then((res) => res.json())
  .then((data) => {
    el.textContent = `API: ${data.status} (${data.timestamp})`;
    el.classList.add('ok');
  })
  .catch(() => {
    el.textContent = 'API: unreachable';
    el.classList.add('error');
  });
