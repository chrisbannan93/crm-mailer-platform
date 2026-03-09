import type { WebsiteContent } from './types/index.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderPublicSite(content: WebsiteContent): string {
  const metricCards = content.proof.metrics
    .map(
      (metric) => `
        <article class="metricCard">
          <div class="metricValue">${escapeHtml(metric.value)}</div>
          <div class="metricLabel">${escapeHtml(metric.label)}</div>
          ${metric.detail ? `<p class="metricDetail">${escapeHtml(metric.detail)}</p>` : ''}
        </article>`,
    )
    .join('');

  const sections = content.sections
    .map(
      (section) => `
        <section class="sectionCard">
          <h3>${escapeHtml(section.title)}</h3>
          <p>${escapeHtml(section.body)}</p>
          ${section.bullets?.length ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}</ul>` : ''}
        </section>`,
    )
    .join('');

  const testimonials = content.testimonials
    .map(
      (item) => `
        <article class="quoteCard">
          <p class="quote">“${escapeHtml(item.quote)}”</p>
          <div class="quoteMeta">${escapeHtml(item.name)} · ${escapeHtml(item.role)}</div>
        </article>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(content.name)}</title>
  <style>
    :root {
      --ink: #0b1b1f;
      --muted: #46565b;
      --bg: #f3efe5;
      --panel: rgba(255,255,255,.88);
      --line: rgba(11,27,31,.12);
      --accent: #a33d14;
      --accent-dark: #7a2808;
      --accent-2: #144d44;
      --sand: #efe0bd;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--ink);
      font-family: Georgia, 'Times New Roman', serif;
      background:
        radial-gradient(circle at top left, rgba(239, 224, 189, .9), transparent 32%),
        radial-gradient(circle at right 20%, rgba(20, 77, 68, .15), transparent 30%),
        linear-gradient(180deg, #fbf8f1 0%, var(--bg) 100%);
    }
    a { color: inherit; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 28px; }
    .topbar {
      display:flex; justify-content:space-between; align-items:center; gap:16px;
      margin-bottom: 32px;
    }
    .brand { font-size: 15px; letter-spacing: .18em; text-transform: uppercase; color: var(--accent-dark); }
    .nav { display:flex; gap:12px; flex-wrap:wrap; }
    .nav a, .cta {
      text-decoration:none; border-radius:999px; padding:12px 18px; border:1px solid var(--line);
      background: rgba(255,255,255,.72); font-family: ui-sans-serif, system-ui, sans-serif; font-size:14px;
    }
    .cta.primary { background: var(--accent); color: white; border-color: var(--accent); }
    .hero {
      display:grid; grid-template-columns: 1.3fr .9fr; gap: 24px; align-items: stretch;
      margin-bottom: 28px;
    }
    .heroPanel, .proofPanel, .sectionCard, .quoteCard {
      border: 1px solid var(--line);
      border-radius: 28px;
      background: var(--panel);
      box-shadow: 0 18px 60px rgba(11,27,31,.08);
      backdrop-filter: blur(8px);
    }
    .heroPanel { padding: 40px; }
    .eyebrow {
      display:inline-block; margin-bottom: 14px; padding: 8px 12px; border-radius: 999px;
      background: rgba(163,61,20,.08); color: var(--accent-dark); font: 600 12px/1 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: .12em; text-transform: uppercase;
    }
    h1 { margin: 0 0 16px; font-size: clamp(42px, 6vw, 74px); line-height: .95; letter-spacing: -.04em; }
    .subhead { margin: 0 0 28px; color: var(--muted); font: 400 18px/1.6 ui-sans-serif, system-ui, sans-serif; }
    .ctaRow { display:flex; gap: 12px; flex-wrap: wrap; }
    .heroAside { padding: 28px; display:flex; flex-direction:column; justify-content:space-between; background: linear-gradient(180deg, rgba(20,77,68,.9), rgba(11,27,31,.96)); color:white; }
    .heroAside h2 { margin:0 0 10px; font-size: 28px; }
    .heroAside p { margin:0; color: rgba(255,255,255,.82); font: 400 15px/1.7 ui-sans-serif, system-ui, sans-serif; }
    .proofGrid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 20px; }
    .metricCard { padding: 20px; border-radius: 20px; background: rgba(255,255,255,.76); border:1px solid rgba(11,27,31,.08); }
    .metricValue { font-size: 34px; font-weight: 700; letter-spacing: -.04em; }
    .metricLabel, .metricDetail { font-family: ui-sans-serif, system-ui, sans-serif; }
    .metricLabel { margin-top: 6px; font-size: 14px; color: var(--ink); }
    .metricDetail { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
    .proofPanel { padding: 28px; margin-bottom: 24px; }
    .proofPanel h2, .sectionCard h3 { margin-top: 0; }
    .proofPanel p, .sectionCard p, .quoteMeta { font-family: ui-sans-serif, system-ui, sans-serif; color: var(--muted); }
    .sectionGrid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .sectionCard { padding: 24px; }
    .sectionCard ul { margin: 14px 0 0; padding-left: 18px; font-family: ui-sans-serif, system-ui, sans-serif; color: var(--ink); }
    .quoteGrid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .quoteCard { padding: 24px; }
    .quote { margin:0 0 16px; font-size: 22px; line-height: 1.4; }
    .leadPanel { padding: 28px; margin-bottom: 24px; }
    .leadGrid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .leadPanel label { display:block; font: 600 12px/1.4 ui-sans-serif, system-ui, sans-serif; letter-spacing:.04em; text-transform:uppercase; color: var(--muted); }
    .leadPanel input, .leadPanel select, .leadPanel textarea {
      width:100%; margin-top:6px; padding:12px 14px; border-radius:14px; border:1px solid var(--line);
      background:#fff; font: 400 15px/1.5 ui-sans-serif, system-ui, sans-serif; color:var(--ink);
    }
    .leadPanel textarea { min-height: 120px; resize: vertical; }
    .leadActions { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-top:14px; }
    .leadStatus { font: 400 13px/1.5 ui-sans-serif, system-ui, sans-serif; color: var(--muted); }
    footer { margin: 28px 0 12px; color: var(--muted); font: 400 13px/1.6 ui-sans-serif, system-ui, sans-serif; }
    @media (max-width: 980px) {
      .hero, .sectionGrid, .quoteGrid, .proofGrid, .leadGrid { grid-template-columns: 1fr; }
      .topbar { align-items:flex-start; flex-direction:column; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="brand">${escapeHtml(content.name)}</div>
      <nav class="nav">
        <a href="#proof">Proof</a>
        <a href="#service">Service</a>
        <a href="#stories">Stories</a>
        <a class="cta primary" href="${escapeHtml(content.hero.primaryCta.href)}">${escapeHtml(content.hero.primaryCta.label)}</a>
      </nav>
    </div>

    <section class="hero">
      <article class="heroPanel">
        <span class="eyebrow">${escapeHtml(content.hero.eyebrow)}</span>
        <h1>${escapeHtml(content.hero.headline)}</h1>
        <p class="subhead">${escapeHtml(content.hero.subheadline)}</p>
        <div class="ctaRow">
          <a class="cta primary" href="${escapeHtml(content.hero.primaryCta.href)}">${escapeHtml(content.hero.primaryCta.label)}</a>
          ${content.hero.secondaryCta ? `<a class="cta" href="${escapeHtml(content.hero.secondaryCta.href)}">${escapeHtml(content.hero.secondaryCta.label)}</a>` : ''}
        </div>
      </article>
      <aside class="heroAside">
        <div>
          <h2>${escapeHtml(content.proof.headline)}</h2>
          ${content.proof.body ? `<p>${escapeHtml(content.proof.body)}</p>` : ''}
        </div>
        <div class="proofGrid">${metricCards}</div>
      </aside>
    </section>

    <section id="proof" class="proofPanel">
      <h2>${escapeHtml(content.proof.headline)}</h2>
      ${content.proof.body ? `<p>${escapeHtml(content.proof.body)}</p>` : ''}
    </section>

    <section id="service" class="sectionGrid">${sections}</section>

    <section id="lead-form" class="proofPanel leadPanel">
      <h2>Book a strategy call</h2>
      <p>Use the public enquiry form to push a new lead straight into the CRM so the broker team can respond from Mailer Studio and Twenty.</p>
      <form id="leadForm">
        <div class="leadGrid" style="margin-top:18px;">
          <label>First name
            <input id="leadFirstName" name="firstName" type="text" required />
          </label>
          <label>Last name
            <input id="leadLastName" name="lastName" type="text" />
          </label>
          <label>Email
            <input id="leadEmail" name="email" type="email" required />
          </label>
          <label>Phone
            <input id="leadPhone" name="phone" type="tel" />
          </label>
          <label>Loan type
            <select id="leadLoanType" name="loanType">
              <option value="Retail home loan">Retail home loan</option>
              <option value="Commercial loan">Commercial loan</option>
              <option value="Refinance review">Refinance review</option>
              <option value="Investment lending">Investment lending</option>
            </select>
          </label>
          <label>Best time to contact
            <input id="leadMessageHint" type="text" placeholder="Tomorrow afternoon, next Wednesday, etc." />
          </label>
        </div>
        <label style="display:block; margin-top:12px;">What do you need help with?
          <textarea id="leadMessage" name="message" placeholder="Tell us about the property, current lending position, timing, and any documents already ready."></textarea>
        </label>
        <div class="leadActions">
          <button class="cta primary" type="submit">Request a broker callback</button>
          <div id="leadStatus" class="leadStatus">Enquiries create a CRM person record and follow-up note.</div>
        </div>
      </form>
    </section>

    <section id="stories" class="quoteGrid">${testimonials}</section>

    <footer>${escapeHtml(content.footerNote ?? '')}</footer>
  </div>
  <script>
    const form = document.getElementById('leadForm');
    const status = document.getElementById('leadStatus');
    const messageHint = document.getElementById('leadMessageHint');
    const message = document.getElementById('leadMessage');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = 'Submitting enquiry...';
      const search = new URLSearchParams(window.location.search);
      const payload = {
        firstName: document.getElementById('leadFirstName').value.trim(),
        lastName: document.getElementById('leadLastName').value.trim(),
        email: document.getElementById('leadEmail').value.trim(),
        phone: document.getElementById('leadPhone').value.trim(),
        loanType: document.getElementById('leadLoanType').value,
        message: [message.value.trim(), messageHint.value.trim() ? 'Best time to contact: ' + messageHint.value.trim() : '']
          .filter(Boolean)
          .join('\\n\\n'),
        consentMarketing: true,
        consentCopyVersion: 'privacy_v1',
        utm_source: search.get('utm_source') || undefined,
        utm_medium: search.get('utm_medium') || undefined,
        utm_campaign: search.get('utm_campaign') || undefined,
        utm_term: search.get('utm_term') || undefined,
        utm_content: search.get('utm_content') || undefined,
        landing_path: window.location.pathname,
        referrer: document.referrer || undefined,
      };

      try {
        const response = await fetch('/public/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const text = await response.text();
        const body = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(body.error || body.message || ('HTTP ' + response.status));
        }
        form.reset();
        status.textContent = 'Enquiry captured. The broker team can now follow up from the CRM and Mailer Studio.';
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
    });
  </script>
</body>
</html>`;
}
