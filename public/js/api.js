// Kommunikasjon med backenden (server.js). Nettleseren snakker aldri direkte med Claude.

// Standard: send forespørselen til backenden (server.js).
// Nettsideversjonen på claude.ai bytter dette ut med settTransport().
let transport = null;
export function settTransport(t) { transport = t; }

export async function post(url, data) {
  if (transport) return transport.post(url, data);
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
  if (transport) return transport.status();
  if (!statusCache) {
    statusCache = fetch('/api/status').then((r) => r.json()).catch(() => ({ demo: false, frakoblet: true }));
  }
  return statusCache;
}
