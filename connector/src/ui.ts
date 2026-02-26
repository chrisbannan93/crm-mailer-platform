import type { AppConfig } from './config.js';

export function renderSidecarUi(config: AppConfig): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CRM Connector</title>
  <style>
    :root { --bg:#f4f1e8; --ink:#0d1b1e; --panel:#fffdf7; --accent:#a12f00; --line:#d8d0c0; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background: radial-gradient(circle at 20% 10%, #fff 0, var(--bg) 55%); color: var(--ink); }
    .wrap { max-width: 980px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 10px; font-size: 28px; }
    .sub { margin: 0 0 20px; color: #4c5a5f; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(280px,1fr)); gap: 16px; }
    .card { background: var(--panel); border:1px solid var(--line); border-radius: 14px; padding: 14px; box-shadow: 0 4px 20px rgba(0,0,0,.03); }
    label { display:block; font-size: 12px; margin: 8px 0 4px; color:#556; }
    input, textarea { width:100%; box-sizing:border-box; border:1px solid var(--line); border-radius: 10px; padding: 10px; font: inherit; background: #fff; }
    textarea { min-height: 90px; }
    button { margin-top: 10px; border:0; border-radius: 10px; padding: 10px 12px; background: var(--accent); color: #fff; cursor: pointer; font-weight: 600; }
    pre { background:#101518; color:#d9efe5; padding:12px; border-radius:10px; overflow:auto; max-height: 320px; }
    .row { display:flex; gap: 8px; flex-wrap: wrap; }
    .pill { display:inline-block; padding: 4px 8px; border-radius: 999px; background:#ece5d8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Connector Sidecar</h1>
    <p class="sub">Phase 1 local admin UI for sync + test campaign + engagement writeback. Vertical: <strong>${config.vertical}</strong></p>
    <div class="row">
      <span class="pill">Twenty: ${config.twenty.baseUrl}</span>
      <span class="pill">listmonk: ${config.listmonk.baseUrl}</span>
      <span class="pill">Writeback: ${config.twenty.writebackMode}</span>
    </div>
    <div class="grid" style="margin-top:14px">
      <section class="card">
        <h3>Manual Sync (person ID)</h3>
        <label>Twenty Person ID</label>
        <input id="personId" placeholder="person id" />
        <button id="syncPersonBtn">Sync Person</button>
      </section>
      <section class="card">
        <h3>Test Campaign</h3>
        <label>Recipient email</label>
        <input id="campaignTo" placeholder="you@example.com" />
        <label>Subject</label>
        <input id="campaignSubject" value="Connector test campaign" />
        <label>Optional person ID (for writeback links)</label>
        <input id="campaignPersonId" placeholder="person id" />
        <button id="sendCampaignBtn">Send Test Campaign</button>
      </section>
      <section class="card">
        <h3>Manual Engagement (debug)</h3>
        <label>Type</label>
        <input id="engType" value="manual" />
        <label>Email</label>
        <input id="engEmail" placeholder="contact@example.com" />
        <label>Person ID</label>
        <input id="engPersonId" placeholder="person id" />
        <button id="engBtn">Post Engagement</button>
      </section>
      <section class="card">
        <h3>Recent Events</h3>
        <button id="refreshBtn">Refresh</button>
        <pre id="eventsOut">Loading...</pre>
      </section>
    </div>
    <section class="card" style="margin-top:16px">
      <h3>API Response</h3>
      <pre id="out">Ready.</pre>
    </section>
  </div>
  <script>
    const out = document.getElementById('out');
    const eventsOut = document.getElementById('eventsOut');
    const show = (v) => { out.textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); };
    async function call(path, options) {
      const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
      if (!res.ok) throw new Error((data && data.error) || text || 'Request failed');
      return data;
    }
    async function refreshEvents() {
      const data = await call('/events/recent');
      eventsOut.textContent = JSON.stringify(data, null, 2);
    }
    document.getElementById('refreshBtn').onclick = () => refreshEvents().catch((e) => show(e.message));
    document.getElementById('syncPersonBtn').onclick = async () => {
      try {
        const id = document.getElementById('personId').value.trim();
        show(await call('/sync/person/' + encodeURIComponent(id), { method: 'POST' }));
        await refreshEvents();
      } catch (e) { show(e.message); }
    };
    document.getElementById('sendCampaignBtn').onclick = async () => {
      try {
        show(await call('/campaigns/send-test', { method: 'POST', body: JSON.stringify({
          to: document.getElementById('campaignTo').value.trim(),
          subject: document.getElementById('campaignSubject').value.trim(),
          personId: document.getElementById('campaignPersonId').value.trim() || undefined,
        }) }));
        await refreshEvents();
      } catch (e) { show(e.message); }
    };
    document.getElementById('engBtn').onclick = async () => {
      try {
        show(await call('/webhooks/engagement', { method: 'POST', body: JSON.stringify({
          type: document.getElementById('engType').value.trim(),
          email: document.getElementById('engEmail').value.trim() || undefined,
          personId: document.getElementById('engPersonId').value.trim() || undefined,
          source: 'sidecar-ui'
        }) }));
        await refreshEvents();
      } catch (e) { show(e.message); }
    };
    refreshEvents().catch((e) => show(e.message));
  </script>
</body>
</html>`;
}
