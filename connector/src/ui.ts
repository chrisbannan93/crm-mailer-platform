import type { AppConfig } from './config.js';

export function renderSidecarUi(config: AppConfig): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mailer Studio</title>
  <style>
    :root {
      --bg: #f3efe6;
      --panel: #fffdf8;
      --line: #d7cfbf;
      --ink: #172022;
      --muted: #5d6a70;
      --accent: #a53c00;
      --accent2: #1f6d5e;
      --danger: #b42318;
      --ok: #067647;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, sans-serif;
      background:
        radial-gradient(900px 400px at 5% -10%, #fff8db 0%, transparent 60%),
        radial-gradient(700px 350px at 100% 0%, #e8f6ff 0%, transparent 65%),
        var(--bg);
    }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 22px; }
    .hero {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .panel {
      background: linear-gradient(180deg, #fffefb, var(--panel));
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(17, 24, 39, .05);
      padding: 14px;
    }
    h1 { margin: 0; font-size: 30px; letter-spacing: -0.02em; }
    h2 { margin: 0 0 10px; font-size: 16px; }
    p { margin: 0; color: var(--muted); }
    .chips, .btnRow { display:flex; flex-wrap:wrap; gap:8px; }
    .chips { margin-top: 12px; }
    .chip {
      display:inline-flex; align-items:center; gap:6px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      font-size: 12px;
      color: #304046;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; display:inline-block; }
    .dot.ok { background: #12b76a; }
    .dot.bad { background: #f04438; }
    .grid { display:grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; }
    .col-4 { grid-column: span 4; }
    .col-6 { grid-column: span 6; }
    .col-8 { grid-column: span 8; }
    .col-12 { grid-column: span 12; }
    .metric { display:flex; justify-content:space-between; align-items:center; margin:8px 0; padding:8px 0; border-top:1px dashed #e5dece; }
    .metric:first-of-type { border-top: 0; padding-top: 0; }
    .metric .k { color: var(--muted); font-size: 13px; }
    .metric .v { font-weight: 600; font-size: 13px; text-align:right; }
    button, a.btn {
      border: 0;
      border-radius: 10px;
      padding: 10px 12px;
      text-decoration: none;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    button.primary { background: var(--accent); color: white; }
    button.secondary { background: var(--accent2); color: white; }
    a.btn { background: #fff; color: var(--ink); border:1px solid var(--line); }
    button.ghost { background: #f5f1e8; color: var(--ink); border: 1px solid var(--line); }
    button:disabled { opacity: .6; cursor: wait; }
    .small { font-size: 12px; color: var(--muted); }
    .statusLine { display:flex; align-items:center; gap:8px; margin-top:6px; font-size: 13px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .events {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
      max-height: 520px;
      overflow: auto;
    }
    .evt {
      border: 1px solid #e6dfcf;
      background: #fff;
      border-radius: 12px;
      padding: 10px;
    }
    .evtHead { display:flex; justify-content: space-between; gap: 8px; align-items: baseline; margin-bottom: 6px; }
    .evtMsg { font-weight: 600; font-size: 13px; }
    .evtMeta { font-size: 12px; color: var(--muted); }
    .evt pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11px;
      color: #32424a;
      background: #fbfaf7;
      border: 1px solid #eee6d7;
      border-radius: 8px;
      padding: 8px;
    }
    .log {
      background: #101417;
      color: #d8efe4;
      border-radius: 12px;
      padding: 12px;
      min-height: 140px;
      max-height: 300px;
      overflow: auto;
      font-size: 12px;
    }
    .banner {
      display:none;
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid #d7cfbf;
      background: #fff7ea;
      color: #5f4428;
      font-size: 13px;
    }
    input, select, textarea {
      width:100%; border:1px solid var(--line); border-radius:10px; padding:10px; margin-top:6px;
    }
    textarea { min-height:180px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; }
      .col-4, .col-6, .col-8 { grid-column: span 12; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div id="prefillBanner" class="banner"></div>
    <section class="hero">
      <div class="panel">
        <h1>Mailer Studio</h1>
        <p>Operator control panel for syncs, lifecycle sends, and engagement visibility. Active vertical: <strong>${config.vertical}</strong>.</p>
        <div class="chips">
          <span class="chip">Connector <span class="mono">:${config.port}</span></span>
          <span class="chip">Twenty <span class="mono">${config.twenty.baseUrl}</span></span>
          <span class="chip">listmonk <span class="mono">${config.listmonk.baseUrl}</span></span>
          <span class="chip">Writeback <span class="mono">${config.twenty.writebackMode}</span></span>
        </div>
      </div>
      <div class="panel">
        <h2>Connections</h2>
        <div id="connTwenty" class="statusLine"><span class="dot bad"></span>Twenty: checking…</div>
        <div id="connListmonk" class="statusLine"><span class="dot bad"></span>listmonk: checking…</div>
        <div class="btnRow" style="margin-top:10px;">
          <button id="refreshStatusBtn" class="ghost">Refresh Status</button>
          <a class="btn" href="/" target="_blank" rel="noreferrer">Open Public Site</a>
          <a class="btn" href="${config.listmonk.baseUrl}" target="_blank" rel="noreferrer">Open listmonk UI</a>
        </div>
      </div>
    </section>

    <section class="grid">
      <section class="panel col-4">
        <h2>Sync Controls</h2>
        <div class="metric"><span class="k">Last contact sync</span><span id="lastContactsSync" class="v">Never</span></div>
        <div class="metric"><span class="k">Last list sync</span><span id="lastListsSync" class="v">Never</span></div>
        <label class="small" for="contactSyncMax">Contact sync max (optional, 1-500)</label>
        <input id="contactSyncMax" type="number" min="1" max="500" placeholder="500" />
        <div class="btnRow" style="margin-top:10px;">
          <button id="contactSyncBtn" class="primary">Run Contact Sync</button>
          <button id="listSyncBtn" class="secondary">Run List Sync</button>
        </div>
        <p class="small" style="margin-top:10px;">Contact sync is bounded and cursor-based. List sync performs a full segment membership recompute.</p>
      </section>

      <section class="panel col-8">
        <h2>Template Studio</h2>
        <div class="metric"><span class="k">Active vertical</span><span class="v mono">${config.vertical}</span></div>
        <label class="small" for="templateSelect">Email template</label>
        <select id="templateSelect"><option value="">Loading templates…</option></select>
        <div class="grid" style="margin-top:10px;">
          <div class="col-6">
            <label class="small" for="templateRecipient">Recipient email</label>
            <input id="templateRecipient" type="email" placeholder="borrower@example.com" />
          </div>
          <div class="col-6">
            <label class="small" for="templatePersonId">Person ID (optional)</label>
            <input id="templatePersonId" type="text" placeholder="Twenty person id" />
          </div>
        </div>
        <label class="small" for="templateContext" style="display:block; margin-top:10px;">Application context JSON</label>
        <textarea id="templateContext">{
  "contact": { "firstName": "Chris" },
  "broker": { "name": "Broker Name", "signature": "Broker Name" },
  "application": {
    "applicationId": "APP-001",
    "applicationType": "retail_home_loan",
    "pipelineStage": "docs_requested",
    "lenderTarget": "Example Lender"
  },
  "checklist": { "requiredSummary": "ID, bank statements, privacy consent" }
}</textarea>
        <div class="btnRow" style="margin-top:10px;">
          <button id="previewTemplateBtn" class="ghost">Preview Template</button>
          <button id="sendTemplateBtn" class="secondary">Send Template Test</button>
        </div>
      </section>

      <section class="panel col-4">
        <h2>CRM Quick Load</h2>
        <label class="small" for="contextApplicationId">Loan Application ID</label>
        <input id="contextApplicationId" type="text" placeholder="APP-001" />
        <div class="btnRow" style="margin-top:10px;">
          <button id="loadApplicationBtn" class="ghost">Load Application</button>
          <button id="sendRecommendedBtn" class="secondary">Send Recommended</button>
        </div>
        <label class="small" for="contextPersonId" style="display:block; margin-top:14px;">Person ID</label>
        <input id="contextPersonId" type="text" placeholder="Twenty person id" />
        <div class="btnRow" style="margin-top:10px;">
          <button id="loadPersonBtn" class="ghost">Load Person</button>
        </div>
        <p class="small" style="margin-top:10px;">These actions fetch live Twenty context and prefill the compose form without hand-editing JSON.</p>
      </section>

      <section class="panel col-8">
        <h2>Recent Engagement Events</h2>
        <div class="btnRow" style="margin-top:0; margin-bottom:10px;">
          <button id="refreshEngagementBtn" class="ghost">Refresh Engagement Events</button>
          <button id="refreshAllBtn" class="ghost">Refresh All Events</button>
        </div>
        <ul id="engagementEvents" class="events"></ul>
      </section>

      <section class="panel col-12">
        <h2>Action Output</h2>
        <pre id="logOut" class="log">Ready.</pre>
      </section>
    </section>
  </div>

  <script>
    const $ = (id) => document.getElementById(id);
    const logOut = $('logOut');
    const params = new URLSearchParams(window.location.search);
    let busy = false;

    function setBusy(v) {
      busy = v;
      $('contactSyncBtn').disabled = v;
      $('listSyncBtn').disabled = v;
      $('refreshStatusBtn').disabled = v;
      $('refreshEngagementBtn').disabled = v;
      $('refreshAllBtn').disabled = v;
      $('previewTemplateBtn').disabled = v;
      $('sendTemplateBtn').disabled = v;
      $('loadApplicationBtn').disabled = v;
      $('loadPersonBtn').disabled = v;
      $('sendRecommendedBtn').disabled = v;
    }

    function writeLog(value) {
      logOut.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }

    async function api(path, options = {}) {
      const res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const text = await res.text();
      let body;
      try { body = text ? JSON.parse(text) : {}; } catch { body = text; }
      if (!res.ok) throw new Error((body && body.error) || text || ('HTTP ' + res.status));
      return body;
    }

    function fmtTime(value) {
      if (!value) return 'Never';
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString();
    }

    function setConnLine(el, label, ok, detail) {
      el.innerHTML = '<span class="dot ' + (ok ? 'ok' : 'bad') + '"></span>' + label + ': ' + (ok ? 'reachable' : 'error');
      if (detail && !ok) {
        const hint = document.createElement('div');
        hint.className = 'small';
        hint.textContent = detail;
        el.appendChild(hint);
      }
    }

    function applyPrefills() {
      const banner = $('prefillBanner');
      const personId = params.get('personId');
      const email = params.get('email');
      const template = params.get('template');
      const applicationId = params.get('applicationId');
      const firstName = params.get('firstName');
      const brokerName = params.get('brokerName');
      const lenderTarget = params.get('lenderTarget');
      const pipelineStage = params.get('pipelineStage');
      const applicationType = params.get('applicationType');
      const requiredSummary = params.get('requiredSummary');
      const messages = [];

      if (email) {
        $('templateRecipient').value = email;
        messages.push('recipient email');
      }
      if (personId) {
        $('templatePersonId').value = personId;
        messages.push('person id');
      }

      const textarea = $('templateContext');
      try {
        const value = JSON.parse(textarea.value || '{}');
        value.contact = value.contact || {};
        value.broker = value.broker || {};
        value.application = value.application || {};
        value.checklist = value.checklist || {};
        if (firstName) value.contact.firstName = firstName;
        if (brokerName) {
          value.broker.name = brokerName;
          value.broker.signature = brokerName;
        }
        if (applicationId) value.application.applicationId = applicationId;
        if (personId) value.contact.id = personId;
        if (pipelineStage) value.application.pipelineStage = pipelineStage;
        if (applicationType) value.application.applicationType = applicationType;
        if (lenderTarget) value.application.lenderTarget = lenderTarget;
        if (requiredSummary) value.checklist.requiredSummary = requiredSummary;
        textarea.value = JSON.stringify(value, null, 2);
        if (applicationId) messages.push('application context');
      } catch {
        // leave as-is
      }

      if (template) {
        messages.push('template');
        window.__prefillTemplate = template;
      }

      if (messages.length > 0) {
        banner.style.display = 'block';
        banner.textContent = 'Prefilled from CRM context: ' + messages.join(', ') + '.';
      }
    }

    async function refreshStatus() {
      const data = await api('/studio/status');
      setConnLine($('connTwenty'), 'Twenty', data.services?.twenty?.ok, data.services?.twenty?.detail);
      setConnLine($('connListmonk'), 'listmonk', data.services?.listmonk?.ok, data.services?.listmonk?.detail);
      $('lastContactsSync').textContent = fmtTime(data.lastSync?.contactsAt);
      $('lastListsSync').textContent = fmtTime(data.lastSync?.listsAt);
      return data;
    }

    function renderEvents(items) {
      const root = $('engagementEvents');
      root.innerHTML = '';
      if (!Array.isArray(items) || items.length === 0) {
        root.innerHTML = '<li class="evt"><div class="evtMsg">No events yet.</div><div class="evtMeta">Run syncs or campaign actions to populate this feed.</div></li>';
        return;
      }
      for (const evt of items) {
        const li = document.createElement('li');
        li.className = 'evt';
        li.innerHTML = '<div class="evtHead"><div class="evtMsg">' + (evt.message || evt.kind) + '</div><div class="evtMeta">' + (evt.createdAt ? fmtTime(evt.createdAt) : '') + '</div></div>';
        const meta = document.createElement('div');
        meta.className = 'evtMeta';
        meta.textContent = [evt.kind, evt.status].filter(Boolean).join(' · ');
        li.appendChild(meta);
        if (evt.detail) {
          const pre = document.createElement('pre');
          pre.textContent = JSON.stringify(evt.detail, null, 2);
          li.appendChild(pre);
        }
        root.appendChild(li);
      }
    }

    async function refreshEngagementEvents() {
      const data = await api('/events/recent?kind=engagement&limit=20');
      renderEvents(data.data || []);
    }

    async function refreshAllEventsToLog() {
      const data = await api('/events/recent?limit=20');
      writeLog(data);
    }

    async function refreshTemplates() {
      const data = await api('/templates/email');
      const select = $('templateSelect');
      const items = Array.isArray(data.data) ? data.data : [];
      select.innerHTML = '';
      if (items.length === 0) {
        select.innerHTML = '<option value="">No templates loaded</option>';
        return;
      }
      for (const item of items) {
        const option = document.createElement('option');
        option.value = item.key;
        option.textContent = item.name + (item.trigger ? ' · ' + item.trigger : '');
        if (window.__prefillTemplate && window.__prefillTemplate === item.key) option.selected = true;
        select.appendChild(option);
      }
    }

    async function runContactSync() {
      const rawMax = $('contactSyncMax').value.trim();
      const max = rawMax ? Math.min(Math.max(Number(rawMax), 1), 500) : null;
      const path = max ? ('/sync/contacts?max=' + encodeURIComponent(String(Math.floor(max)))) : '/sync/contacts';
      return api(path, { method: 'POST' });
    }

    async function runListSync() { return api('/sync/lists', { method: 'POST' }); }

    function readTemplateContext() {
      const raw = $('templateContext').value.trim();
      return raw ? JSON.parse(raw) : {};
    }

    async function previewTemplate() {
      return api('/templates/email/render', {
        method: 'POST',
        body: JSON.stringify({ templateKey: $('templateSelect').value, context: readTemplateContext() }),
      });
    }

    async function sendTemplate() {
      return api('/campaigns/send-template', {
        method: 'POST',
        body: JSON.stringify({
          templateKey: $('templateSelect').value,
          to: $('templateRecipient').value.trim(),
          personId: $('templatePersonId').value.trim() || undefined,
          context: readTemplateContext(),
        }),
      });
    }

    function applyContextPayload(payload) {
      if (!payload) return;
      const suggestedTemplate = payload.suggestedTemplateKey;
      if (payload.context?.contact?.email) $('templateRecipient').value = payload.context.contact.email;
      if (payload.context?.contact?.id) $('templatePersonId').value = payload.context.contact.id;
      $('templateContext').value = JSON.stringify(payload.context || {}, null, 2);
      if (suggestedTemplate) {
        window.__prefillTemplate = suggestedTemplate;
        const options = Array.from($('templateSelect').options);
        const match = options.find((option) => option.value === suggestedTemplate);
        if (match) $('templateSelect').value = suggestedTemplate;
      }
    }

    async function loadApplicationContext() {
      const applicationId = $('contextApplicationId').value.trim();
      if (!applicationId) throw new Error('Enter a Loan Application ID');
      const data = await api('/studio/context/application/' + encodeURIComponent(applicationId));
      applyContextPayload({
        context: data.data,
        suggestedTemplateKey: data.suggestedTemplateKey || data.data?.suggestedTemplateKey,
      });
      return data;
    }

    async function loadPersonContext() {
      const personId = $('contextPersonId').value.trim();
      if (!personId) throw new Error('Enter a Person ID');
      const data = await api('/studio/context/person/' + encodeURIComponent(personId));
      applyContextPayload({
        context: data.data,
        suggestedTemplateKey: data.suggestedTemplateKey || data.data?.suggestedTemplateKey,
      });
      return data;
    }

    async function sendRecommendedForApplication() {
      const applicationId = $('contextApplicationId').value.trim();
      if (!applicationId) throw new Error('Enter a Loan Application ID');
      return api('/campaigns/send-for-application', {
        method: 'POST',
        body: JSON.stringify({
          applicationId,
          templateKey: $('templateSelect').value || undefined,
          to: $('templateRecipient').value.trim() || undefined,
          personId: $('templatePersonId').value.trim() || undefined,
        }),
      });
    }

    async function wrapAction(label, fn) {
      if (busy) return;
      setBusy(true);
      try {
        const result = await fn();
        writeLog({ action: label, result });
        await Promise.all([refreshStatus(), refreshEngagementEvents()]);
      } catch (err) {
        writeLog({ action: label, error: err && err.message ? err.message : String(err) });
      } finally {
        setBusy(false);
      }
    }

    $('refreshStatusBtn').onclick = () => wrapAction('refresh-status', refreshStatus);
    $('contactSyncBtn').onclick = () => wrapAction('contact-sync', runContactSync);
    $('listSyncBtn').onclick = () => wrapAction('list-sync', runListSync);
    $('refreshEngagementBtn').onclick = () => wrapAction('refresh-engagement-events', refreshEngagementEvents);
    $('refreshAllBtn').onclick = () => wrapAction('refresh-all-events', refreshAllEventsToLog);
    $('previewTemplateBtn').onclick = () => wrapAction('preview-template', previewTemplate);
    $('sendTemplateBtn').onclick = () => wrapAction('send-template', sendTemplate);
    $('loadApplicationBtn').onclick = () => wrapAction('load-application-context', loadApplicationContext);
    $('loadPersonBtn').onclick = () => wrapAction('load-person-context', loadPersonContext);
    $('sendRecommendedBtn').onclick = () => wrapAction('send-recommended-template', sendRecommendedForApplication);

    applyPrefills();
    (async () => {
      try {
        await refreshStatus();
        await refreshTemplates();
        await refreshEngagementEvents();
      } catch (err) {
        writeLog(err && err.message ? err.message : String(err));
      }
    })();
  </script>
</body>
</html>`;
}
