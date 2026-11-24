// Kommunikasjon med backenden (server.js). Nettleseren snakker aldri direkte med Claude.

export async function post(url, data) {
  let svar;
  try {
    svar = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  } catch {
    throw new Error('Får ikke kontakt med appens server. Kjører start.bat-vinduet fortsatt?');
  }
  const json = await svar.json().catch(() => ({}));
  if (!svar.ok) throw new Error(json.feil || `Serverfeil (${svar.status})`);
  return json;
}

let statusCache = null;
export async function status() {
  if (!statusCache) {
    statusCache = fetch('/api/status').then((r) => r.json()).catch(() => ({ demo: false, frakoblet: true }));
  }
  return statusCache;
}
