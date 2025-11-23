const params = new URLSearchParams(location.search);
const code = params.get('c') || '';
const content = document.getElementById('content');

async function load() {
  if (!code) {
    content.innerHTML = '<p>No code provided in query (use ?c=CODE)</p>';
    return;
  }
  try {
    const r = await fetch(`/api/links/${code}`);
    if (r.status === 404) {
      content.innerHTML = '<p>Not found</p>';
      return;
    }
    const j = await r.json();
    content.innerHTML = `
      <p><strong>Code:</strong> ${j.code}</p>
      <p><strong>Short URL:</strong> <a href="/${j.code}" target="_blank">${location.origin}/${j.code}</a></p>
      <p><strong>Target:</strong> <a href="${j.target}" target="_blank">${j.target}</a></p>
      <p><strong>Clicks:</strong> ${j.total_clicks}</p>
      <p><strong>Created:</strong> ${new Date(j.created_at).toLocaleString()}</p>
      <p><strong>Last clicked:</strong> ${j.last_clicked ? new Date(j.last_clicked).toLocaleString() : '-'}</p>
    `;
  } catch (e) {
    content.innerHTML = '<p>Network error</p>';
  }
}

load();
