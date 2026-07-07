import { Resend } from 'resend';

// ─── Config ───────────────────────────────────────────────────────────────────
// Set RESEND_API_KEY and NOTIFICATION_EMAIL in Render.com env vars for production.
// For local dev, export them in your terminal before running npm run dev.
const RESEND_API_KEY     = process.env.RESEND_API_KEY;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL;
const FROM_EMAIL         = process.env.FROM_EMAIL || 'onboarding@resend.dev';

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Prevents email spam: max 1 email per 60 s for the same function + error combo
const recentErrors = new Map();
const RATE_LIMIT_MS = 60_000;

function isRateLimited(key) {
    const last = recentErrors.get(key);
    return last && Date.now() - last < RATE_LIMIT_MS;
}

function markSent(key) {
    recentErrors.set(key, Date.now());
    // Prune old entries to avoid memory growth
    for (const [k, ts] of recentErrors.entries()) {
        if (Date.now() - ts > RATE_LIMIT_MS * 10) recentErrors.delete(k);
    }
}

// ─── Colombia time (UTC-5, no DST) ────────────────────────────────────────────
function colombiaTimestamp() {
    const now = new Date();
    const col = new Date(now.getTime() + (-5 * 60 * 60 * 1000));
    return col.toISOString().replace('T', ' ').slice(0, 19) + ' COL';
}

// ─── Route → page name map ────────────────────────────────────────────────────
const ROUTE_PAGE_MAP = [
    // Deposits
    { method: 'POST',   pattern: /^\/deposits$/,                   page: 'Cobrar Orden  →  /cobrarOrden/:id' },
    { method: 'DELETE', pattern: /^\/deposits\/[^/]+$/,            page: 'Cobrar Orden  →  /cobrarOrden/:id' },
    { method: 'GET',    pattern: /^\/deposits\/[^/]+$/,            page: 'Cobrar Orden  →  /cobrarOrden/:id' },
    { method: 'GET',    pattern: /^\/deposits$/,                   page: 'Historial de Abonos  →  /abonos' },
    { method: 'GET',    pattern: /^\/depositsByDate\//,            page: 'Cobros del Día  →  /cobrosHoy' },
    // Orders
    { method: 'POST',   pattern: /^\/order$/,                      page: 'Nueva Orden  →  /nuevaOrden' },
    { method: 'PUT',    pattern: /^\/order\/[^/]+$/,               page: 'Editar / Cobrar Orden  →  /editarOrden/:id  o  /cobrarOrden/:id' },
    { method: 'DELETE', pattern: /^\/order\/[^/]+$/,               page: 'Dashboard  →  /' },
    { method: 'GET',    pattern: /^\/orders\/$/,                   page: 'Dashboard Cuentas por Cobrar  →  /' },
    { method: 'GET',    pattern: /^\/order\/[^/]+$/,               page: 'Cobrar Orden  →  /cobrarOrden/:id' },
    { method: 'GET',    pattern: /^\/unPaidOrders\//,              page: 'Cobrar por Ubicación  →  /cobrarOrdenes/:mall' },
    { method: 'GET',    pattern: /^\/unPaidOrdersByClient\//,      page: 'Nueva Orden - selección de cliente  →  /nuevaOrden' },
    { method: 'GET',    pattern: /^\/notDeliveredOrders/,          page: 'Recorrido  →  /recorrido' },
    { method: 'GET',    pattern: /^\/deliveredOrders\//,           page: 'Entregados  →  /entregados' },
    { method: 'GET',    pattern: /^\/depositedOrdersByDate\//,     page: 'Cobros del Día  →  /cobrosHoy' },
    { method: 'GET',    pattern: /^\/collectedOrders\//,           page: 'Cobros del Día  →  /cobrosHoy' },
    { method: 'GET',    pattern: /^\/orphanedOrders/,              page: 'Sin Usuario  →  /ordenesSinCliente' },
    { method: 'GET',    pattern: /^\/abandonedOrders/,             page: 'Abandonadas  →  /ordenesAbandonadas' },
    { method: 'PUT',    pattern: /^\/order\/[^/]+\/abandon$/,      page: 'Abandonadas  →  /ordenesAbandonadas' },
    { method: 'PUT',    pattern: /^\/order\/[^/]+\/reactivate$/,   page: 'Abandonadas  →  /ordenesAbandonadas' },
    { method: 'PUT',    pattern: /^\/order\/[^/]+\/restore$/,      page: 'Copias de Seguridad  →  /copiasSeguridad' },
    // Backups
    { method: 'GET',    pattern: /^\/backupsByDate\//,             page: 'Copias de Seguridad  →  /copiasSeguridad' },
    { method: 'GET',    pattern: /^\/orderRestores\//,             page: 'Copias de Seguridad  →  /copiasSeguridad' },
    // Clients
    { method: 'POST',   pattern: /^\/client$/,                     page: 'Nuevo Cliente  →  /nuevoCliente' },
    { method: 'PUT',    pattern: /^\/client\/[^/]+$/,              page: 'Editar Cliente  →  /editarCliente/:id' },
    { method: 'DELETE', pattern: /^\/client\/[^/]+$/,              page: 'Clientes  →  /clientes' },
    { method: 'GET',    pattern: /^\/clients$/,                    page: 'Clientes  →  /clientes' },
    { method: 'GET',    pattern: /^\/clients\//,                   page: 'Nueva Orden - selector de clientes  →  /nuevaOrden' },
    { method: 'GET',    pattern: /^\/client\/[^/]+$/,              page: 'Formulario de Orden  →  /nuevaOrden  o  /editarOrden/:id' },
    // Products
    { method: 'POST',   pattern: /^\/product$/,                    page: 'Nuevo Producto  →  /nuevoProducto' },
    { method: 'PUT',    pattern: /^\/product\/[^/]+$/,             page: 'Editar Producto  →  /editarProducto/:id' },
    { method: 'DELETE', pattern: /^\/product\/[^/]+$/,             page: 'Productos  →  /productos' },
    { method: 'GET',    pattern: /^\/products$/,                   page: 'Catálogo  →  /productos  o  /nuevaOrden' },
    { method: 'GET',    pattern: /^\/product\/[^/]+$/,             page: 'Editar Producto  →  /editarProducto/:id' },
    // Auth
    { method: 'GET',    pattern: /^\/users\//,                     page: 'Iniciar Sesión  →  /iniciarSesion' },
];

function resolvePage(method, path) {
    for (const { method: m, pattern, page } of ROUTE_PAGE_MAP) {
        if (m === method && pattern.test(path)) return page;
    }
    return 'Página desconocida';
}

// ─── Body analyzer ────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = {
    createDeposit:  ['orderId', 'clientId', 'depositValue', 'lastDeposit', 'newDeposit'],
    createOrder:    ['clientId', 'items'],
    createClient:   ['premises', 'clientName', 'mall', 'phoneNumber'],
    createProduct:  ['productName', 'unitValue'],
};

function analyzeBody(body, functionName) {
    if (!body || Object.keys(body).length === 0) {
        return { label: 'Sin datos enviados', color: '#6B7280', detail: 'El cuerpo de la solicitud estaba vacío o era nulo.' };
    }
    const required = REQUIRED_FIELDS[functionName] || [];
    const missing = required.filter(f => body[f] === undefined || body[f] === null);
    if (missing.length > 0) {
        return {
            label: 'Error de validación — campos faltantes',
            color: '#D97706',
            detail: `Campos faltantes: ${missing.join(', ')}`,
        };
    }
    return { label: 'Datos enviados con error', color: '#DC2626', detail: 'Se enviaron datos pero la operación falló en la base de datos.' };
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Call this inside any catch block:
 *   sendErrorEmail(req, error, 'createDeposit');
 *
 * Non-blocking — wrap in its own try/catch so it never crashes the server.
 */
export async function sendErrorEmail(req, error, functionName) {
    try {
        if (!RESEND_API_KEY || !NOTIFICATION_EMAIL) {
            console.error('[emailNotifier] RESEND_API_KEY or NOTIFICATION_EMAIL not configured. Email not sent.');
            return;
        }

        const rateKey = `${functionName}::${error?.message}`;
        if (isRateLimited(rateKey)) {
            console.log(`[emailNotifier] Rate limited — skipping duplicate for: ${rateKey}`);
            return;
        }
        markSent(rateKey);

        const resend = new Resend(RESEND_API_KEY);
        const ts      = colombiaTimestamp();
        const method  = req?.method  || '?';
        const path    = req?.path    || '?';
        const params  = req?.params  || {};
        const query   = req?.query   || {};
        const body    = req?.body    || {};
        const user    = req?.headers?.['x-user'] || null;
        const pagePath = req?.headers?.['x-page-path'] || null;

        const page    = resolvePage(method, path);
        const analysis = analyzeBody(body, functionName);

        // Mask sensitive fields
        const safeBody = { ...body };
        if (safeBody.pass)     safeBody.pass     = '***';
        if (safeBody.password) safeBody.password = '***';

        // Key context IDs
        const orderId   = body.orderId   || params.id   || null;
        const clientId  = body.clientId  || params.clientId || null;
        const ids = [];
        if (orderId)  ids.push(`Orden ID: <strong style="font-size:16px">${orderId}</strong>`);
        if (clientId) ids.push(`Cliente ID: <strong style="font-size:16px">${clientId}</strong>`);

        const idsBanner = ids.length
            ? `<div style="background:#FEF3C7;padding:14px 28px;border-bottom:1px solid #FDE68A;font-size:14px">${ids.join(' &nbsp;│&nbsp; ')}</div>`
            : '';

        const bodyJson = Object.keys(safeBody).length
            ? `<pre style="background:#1a1a2e;color:#e2e8f0;padding:14px;border-radius:6px;font-size:12px;overflow-x:auto;margin:0">${JSON.stringify(safeBody, null, 2)}</pre>`
            : `<em style="color:#9CA3AF">Sin datos</em>`;

        const paramsHtml = Object.keys(params).length
            ? `<code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${JSON.stringify(params)}</code>`
            : '<span style="color:#9CA3AF">—</span>';

        const queryHtml = Object.keys(query).length
            ? `<code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${JSON.stringify(query)}</code>`
            : '<span style="color:#9CA3AF">—</span>';

        const userRow = user
            ? `<tr><td style="${tdLeft}">Usuario</td><td style="${tdRight}">${user}</td></tr>`
            : '';
        const pagePathRow = pagePath
            ? `<tr style="background:#F9FAFB"><td style="${tdLeft}">URL exacta</td><td style="${tdRight}"><code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${pagePath}</code></td></tr>`
            : '';
        const sqlRow = error?.sqlMessage
            ? `<tr><td style="${tdLeft}">Error SQL</td><td style="${tdRight};color:#B91C1C;font-family:monospace;font-size:12px">${error.sqlMessage}</td></tr>`
            : '';
        const codeRow = error?.code
            ? `<tr style="background:#F9FAFB"><td style="${tdLeft}">Código SQL</td><td style="${tdRight}"><code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px">${error.code}</code></td></tr>`
            : '';

        const stackHtml = error?.stack
            ? `<details style="margin-top:0">
                <summary style="cursor:pointer;color:#6B7280;font-size:12px;padding:10px 0">▶ Ver stack trace completo</summary>
                <pre style="background:#1a1a2e;color:#e2e8f0;padding:14px;border-radius:6px;font-size:11px;overflow-x:auto;margin-top:8px">${error.stack}</pre>
               </details>`
            : '';

        const tdLeft  = 'padding:10px 14px;color:#6B7280;font-weight:600;width:150px;vertical-align:top;font-size:13px';
        const tdRight = 'padding:10px 14px;font-size:13px;color:#111827';

        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F3F4F6;margin:0;padding:20px">
<div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1)">

  <!-- Header -->
  <div style="background:#B91C1C;padding:22px 28px">
    <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">🔴 Error en BlackCoffe Backend</h1>
    <p style="color:#FCA5A5;margin:6px 0 0;font-size:13px">${ts}</p>
  </div>

  ${idsBanner}

  <!-- Info table -->
  <div style="padding:22px 28px 0">
    <table style="width:100%;border-collapse:collapse;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">
      <tr style="background:#F9FAFB">
        <td style="${tdLeft}">Función</td>
        <td style="${tdRight}"><code style="background:#EFF6FF;color:#1D4ED8;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:600">${functionName}</code></td>
      </tr>
      <tr>
        <td style="${tdLeft}">Ruta HTTP</td>
        <td style="${tdRight}"><code style="background:#F3F4F6;padding:3px 10px;border-radius:4px;font-size:13px">${method} ${path}</code></td>
      </tr>
      <tr style="background:#F9FAFB">
        <td style="${tdLeft}">Página del usuario</td>
        <td style="${tdRight}">${page}</td>
      </tr>
      ${pagePathRow}
      <tr>
        <td style="${tdLeft}">Parámetros URL</td>
        <td style="${tdRight}">${paramsHtml}</td>
      </tr>
      <tr style="background:#F9FAFB">
        <td style="${tdLeft}">Query string</td>
        <td style="${tdRight}">${queryHtml}</td>
      </tr>
      ${userRow}
      ${sqlRow}
      ${codeRow}
    </table>
  </div>

  <!-- Body / data sent -->
  <div style="padding:22px 28px 0">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151">
      Datos enviados —
      <span style="color:${analysis.color};font-weight:600">${analysis.label}</span>
    </p>
    <p style="margin:0 0 10px;font-size:12px;color:#6B7280">${analysis.detail}</p>
    ${bodyJson}
  </div>

  <!-- Error message -->
  <div style="padding:22px 28px 0">
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#374151">Mensaje de error</p>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:14px;font-family:monospace;font-size:13px;color:#B91C1C">
      ${error?.message || 'Sin mensaje de error'}
    </div>
  </div>

  <!-- Stack trace -->
  <div style="padding:16px 28px 0">${stackHtml}</div>

  <!-- Footer -->
  <div style="background:#F9FAFB;padding:16px 28px;margin-top:22px;border-top:1px solid #E5E7EB">
    <p style="margin:0;font-size:11px;color:#9CA3AF">BlackCoffe · Render.com · ${ts}</p>
  </div>

</div>
</body></html>`;

        await resend.emails.send({
            from:    FROM_EMAIL,
            to:      NOTIFICATION_EMAIL,
            subject: `🚨 [BlackCoffe] Error en ${functionName} — ${ts}`,
            html,
        });

        console.log(`[${new Date().toISOString()}] [emailNotifier] Alerta enviada → ${functionName}`);

    } catch (emailErr) {
        // CRITICAL: never let email errors crash the server
        console.error(`[${new Date().toISOString()}] [emailNotifier] Fallo al enviar email:`, emailErr.message);
    }
}
