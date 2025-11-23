const BASE = (window.BASE_URL || '') || (window.location.origin);
const createForm = document.getElementById('createForm');
const targetInput = document.getElementById('target');
const codeInput = document.getElementById('code');
const createBtn = document.getElementById('createBtn');
const createMsg = document.getElementById('createMsg');

const loading = document.getElementById('loading');
const linksTable = document.getElementById('linksTable');
const tbody = linksTable.querySelector('tbody');
const empty = document.getElementById('empty');
const search = document.getElementById('search');
const healthSpan = document.getElementById('health');

async function fetchHealth() {
  try {
    const r = await fetch('/healthz');
    const j = await r.json();
    healthSpan.textContent = j.ok ? 'OK' : 'NO';
  } catch (e) {
    healthSpan.textContent = 'ERR';
  }
}

async function loadLinks() {
  loading.classList.remove('hidden');
  linksTable.classList.add('hidden');
  empty.classList.add('hidden');
  try {
    const r = await fetch('/api/links');
    const rows = await r.json();
    tbody.innerHTML = '';
    if (!rows.length) {
      empty.classList.remove('hidden');
    } else {
      rows.forEach(row => {
        const tr = document.createElement('tr');
        const shortUrl = `${BASE}/${row.code}`;
        tr.innerHTML = `
          <td><a href="${shortUrl}" target="_blank">${row.code}</a></td>
          <td title="${row.target}">${truncate(row.target, 60)}</td>
          <td>${row.total_clicks}</td>
          <td>${row.last_clicked ? new Date(row.last_clicked).toLocaleString() : '-'}</td>
          <td></td>
        `;
        const actionsCell = tr.querySelector('td:last-child');

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.className = 'copyBtn';
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(shortUrl);
          copyBtn.textContent = 'Copied';
          setTimeout(() => copyBtn.textContent = 'Copy', 1500);
        });

        const viewBtn = document.createElement('button');
        viewBtn.textContent = 'Stats';
        viewBtn.className = 'viewBtn';
        viewBtn.onclick = () => window.open(`/stats.html?c=${row.code}`, '_blank');

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.className = 'delBtn';
        delBtn.onclick = async () => {
          if (!confirm('Delete this link?')) return;
          const res = await fetch(`/api/links/${row.code}`, { method: 'DELETE' });
          if (res.ok) loadLinks();
          else alert('Delete failed');
        };

        actionsCell.appendChild(copyBtn);
        actionsCell.appendChild(viewBtn);
        actionsCell.appendChild(delBtn);
        tbody.appendChild(tr);
      });
      linksTable.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.classList.add('hidden');
  }
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

createForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  createBtn.disabled = true;
  createMsg.textContent = 'Creating...';
  try {
    const payload = { target: targetInput.value.trim() };
    if (codeInput.value.trim()) payload.code = codeInput.value.trim();
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.status === 201) {
      const j = await res.json();
      createMsg.textContent = `Created ${j.code} — ${BASE}/${j.code}`;
      targetInput.value = '';
      codeInput.value = '';
      loadLinks();
    } else if (res.status === 409) {
      const j = await res.json();
      createMsg.textContent = j.error || 'Conflict';
    } else {
      const j = await res.json();
      createMsg.textContent = j.error || 'Error';
    }
  } catch (err) {
    createMsg.textContent = 'Network error';
  } finally {
    createBtn.disabled = false;
    setTimeout(() => (createMsg.textContent = ''), 3000);
  }
});

search.addEventListener('input', () => {
  const q = search.value.toLowerCase();
  Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
});

fetchHealth();
loadLinks();
