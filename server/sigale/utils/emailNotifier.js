/*
 * ============================================================
 * SÍGALE — ERROR NOTIFIER (Resend)
 * Ported from BlackCoffe's utils/emailNotifier.js (see reference/).
 * Call inside any catch block and in the global error middleware:
 *
 *     sendErrorEmail(req, error, 'createPurchase');
 *
 * Non-blocking and self-contained: it never throws, so a mail
 * failure can never crash the server. Rate-limited to one mail
 * per 60 s per (function + error message) pair.
 * ============================================================
 */

import { Resend } from 'resend';

// ─── Config ───────────────────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const recentErrors = new Map();
const RATE_LIMIT_MS = 60_000;

function isRateLimited(key) {
  const last = recentErrors.get(key);
  return last && Date.now() - last < RATE_LIMIT_MS;
}

function markSent(key) {
  recentErrors.set(key, Date.now());
  for (const [k, ts] of recentErrors.entries()) {
    if (Date.now() - ts > RATE_LIMIT_MS * 10) recentErrors.delete(k);
  }
}

// ─── Colombia time (UTC-5, no DST) ────────────────────────────────────────────
function colombiaTimestamp() {
  const now = new Date();
  const col = new Date(now.getTime() + -5 * 60 * 60 * 1000);
  return col.toISOString().replace('T', ' ').slice(0, 19) + ' COL';
}

// ─── Route → page name map (Sígale routes) ─────────────────────────────────────
const ROUTE_PAGE_MAP = [
  { method: 'GET', pattern: /^\/api\/events\/[^/]+$/, page: 'Evento  →  /evento/:id' },
  { method: 'POST', pattern: /^\/api\/purchases$/, page: 'Reserva  →  /compra (Selección)' },
  { method: 'POST', pattern: /^\/api\/purchases\/[^/]+\/submitted$/, page: 'Ya realicé el pago  →  /compra (WhatsApp)' },
  { method: 'GET', pattern: /^\/api\/purchases\/[^/]+$/, page: 'Estado de compra  →  /compra/:orderId' },
  { method: 'GET', pattern: /^\/api\/recover$/, page: 'Recuperar folio  →  /recuperar-folio' },
  { method: 'POST', pattern: /^\/api\/login$/, page: 'Ingreso Organizador  →  /admin' },
  { method: 'GET', pattern: /^\/api\/admin\/purchases$/, page: 'Panel  →  /admin' },
  { method: 'POST', pattern: /^\/api\/admin\/purchases\/[^/]+\/confirm$/, page: 'Confirmar pago  →  /admin' },
  { method: 'POST', pattern: /^\/api\/admin\/purchases\/[^/]+\/reject$/, page: 'Rechazar pago  →  /admin' },
  { method: 'POST', pattern: /^\/api\/admin\/sales$/, page: 'Registro directo  →  /admin' },
  { method: 'GET', pattern: /^\/api\/admin\/scan\/manifest$/, page: 'Escáner (manifiesto)  →  /scan' },
  { method: 'POST', pattern: /^\/api\/admin\/scan/, page: 'Escáner (puerta)  →  /scan' },
];

function resolvePage(method, path) {
  for (const { method: m, pattern, page } of ROUTE_PAGE_MAP) {
    if (m === method && pattern.test(path)) return page;
  }
  return 'Página desconocida';
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Fire-and-forget error mailer. Wraps its whole body in try/catch so an email
 * failure never crashes the server.
 */
export async function sendErrorEmail(req, error, functionName) {
  try {
    if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
      console.error('[sigale/emailNotifier] RESEND_API_KEY or NOTIFICATION_EMAIL not configured. Email not sent.');
      return;
    }

    const rateKey = `${functionName}::${error?.message}`;
    if (isRateLimited(rateKey)) {
      console.log(`[sigale/emailNotifier] Rate limited — skipping duplicate for: ${rateKey}`);
      return;
    }
    markSent(rateKey);

    const resend = new Resend(RESEND_API_KEY);
    const ts = colombiaTimestamp();
    const method = req?.method || '?';
    const path = req?.path || '?';
    const params = req?.params || {};
    const query = req?.query || {};
    const body = req?.body || {};

    const page = resolvePage(method, path);

    // Mask sensitive fields before logging the body.
    const safeBody = { ...body };
    if (safeBody.password) safeBody.password = '***';
    if (safeBody.pass) safeBody.pass = '***';

    const tdLeft = 'padding:10px 14px;color:#6B7280;font-weight:600;width:150px;vertical-align:top;font-size:13px';
    const tdRight = 'padding:10px 14px;font-size:13px;color:#111827';

    const bodyJson = Object.keys(safeBody).length
      ? `<pre style="background:#120C14;color:#F3E8D6;padding:14px;border-radius:6px;font-size:12px;overflow-x:auto;margin:0">${JSON.stringify(safeBody, null, 2)}</pre>`
      : '<em style="color:#9CA3AF">Sin datos</em>';

    const sqlRow = error?.sqlMessage
      ? `<tr><td style="${tdLeft}">Error SQL</td><td style="${tdRight};color:#B91C1C;font-family:monospace;font-size:12px">${error.sqlMessage}</td></tr>`
      : '';
    const codeRow = error?.code
      ? `<tr style="background:#F9FAFB"><td style="${tdLeft}">Código SQL</td><td style="${tdRight}"><code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${error.code}</code></td></tr>`
      : '';
    const stackHtml = error?.stack
      ? `<details style="margin-top:0"><summary style="cursor:pointer;color:#6B7280;font-size:12px;padding:10px 0">▶ Ver stack trace completo</summary><pre style="background:#120C14;color:#F3E8D6;padding:14px;border-radius:6px;font-size:11px;overflow-x:auto;margin-top:8px">${error.stack}</pre></details>`
      : '';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F3F4F6;margin:0;padding:20px">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
  <div style="background:#8B4A91;padding:22px 28px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Error en Sígale Backend</h1>
    <p style="color:#CBB7DA;margin:6px 0 0;font-size:13px">${ts}</p>
  </div>
  <div style="padding:22px 28px 0">
    <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
      <tr style="background:#F9FAFB"><td style="${tdLeft}">Función</td><td style="${tdRight}"><code style="background:#F3E8FF;color:#8B4A91;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:600">${functionName}</code></td></tr>
      <tr><td style="${tdLeft}">Ruta HTTP</td><td style="${tdRight}"><code style="background:#F3F4F6;padding:3px 10px;border-radius:4px;font-size:13px">${method} ${path}</code></td></tr>
      <tr style="background:#F9FAFB"><td style="${tdLeft}">Página del usuario</td><td style="${tdRight}">${page}</td></tr>
      <tr><td style="${tdLeft}">Parámetros URL</td><td style="${tdRight}"><code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${JSON.stringify(params)}</code></td></tr>
      <tr style="background:#F9FAFB"><td style="${tdLeft}">Query string</td><td style="${tdRight}"><code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${JSON.stringify(query)}</code></td></tr>
      ${sqlRow}
      ${codeRow}
    </table>
  </div>
  <div style="padding:22px 28px 0">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151">Datos enviados</p>
    ${bodyJson}
  </div>
  <div style="padding:22px 28px 0">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151">Mensaje de error</p>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:14px;font-family:monospace;font-size:13px;color:#B91C1C">${error?.message || 'Sin mensaje de error'}</div>
  </div>
  <div style="padding:16px 28px 0">${stackHtml}</div>
  <div style="background:#F9FAFB;padding:16px 28px;margin-top:22px;border-top:1px solid #E5E7EB">
    <p style="margin:0;font-size:11px;color:#9CA3AF">Sígale · Render.com · ${ts}</p>
  </div>
</div>
</body></html>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFICATION_EMAIL,
      subject: `[Sígale] Error en ${functionName} — ${ts}`,
      html,
    });

    console.log(`[${new Date().toISOString()}] [sigale/emailNotifier] Alerta enviada → ${functionName}`);
  } catch (emailErr) {
    // CRITICAL: never let email errors crash the server.
    console.error(`[${new Date().toISOString()}] [sigale/emailNotifier] Fallo al enviar email:`, emailErr.message);
  }
}
