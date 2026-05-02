export const PORT = process.env.PORT || 25060;

/**
 * NODE_ENV: 'production' | 'development' (default 'development').
 * Render sets NODE_ENV=production automatically.
 */
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

/**
 * Allowed CORS origins.
 *
 * Audit fix 2.6 — previously the production server allowed `http://localhost:5173`
 * and `http://localhost:25060` alongside the prod domain, which (with credentials:true)
 * lets a malicious local page on a developer's box drive authenticated requests.
 *
 * Now:
 *   - In production: take origins ONLY from the ALLOWED_ORIGINS env var (comma-separated).
 *     Falls back to the public Render domain if the env var is missing.
 *   - In development: include the prod domain plus the usual localhost dev ports.
 *
 * To change in prod: set ALLOWED_ORIGINS in the Render dashboard, e.g.
 *   ALLOWED_ORIGINS=https://blackcofeepedidos.onrender.com,https://www.blackcoffe.co
 */
const PROD_DEFAULT_ORIGINS = ['https://blackcofeepedidos.onrender.com'];
const DEV_DEFAULT_ORIGINS = [
    'https://blackcofeepedidos.onrender.com',
    'http://localhost:5173',
    'http://localhost:25060',
];

const parseOrigins = (raw) =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

export const ALLOWED_ORIGINS = (() => {
    if (process.env.ALLOWED_ORIGINS) return parseOrigins(process.env.ALLOWED_ORIGINS);
    return IS_PRODUCTION ? PROD_DEFAULT_ORIGINS : DEV_DEFAULT_ORIGINS;
})();