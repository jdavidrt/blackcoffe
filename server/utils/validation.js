/**
 * Lightweight input-validation helpers for write endpoints (audit fix 2.7).
 *
 * Why a homegrown helper instead of a full library (zod / joi):
 *   - Zero extra dependency footprint.
 *   - Schemas read like the column whitelist they actually are.
 *   - All validation happens at the controller boundary; pool.query never
 *     sees a key that wasn't explicitly allowed.
 *
 * Usage:
 *   const sanitized = pickAndValidate(req.body, ORDER_UPDATE_SCHEMA);
 *   if (sanitized.errors) return res.status(400).json({ message: sanitized.errors[0] });
 *   await pool.query("UPDATE orders SET ? WHERE id = ?", [sanitized.value, id]);
 *
 * Schema field types:
 *   - 'string'  : non-empty string. Optional `max` for length cap.
 *   - 'number'  : finite number (int or float). Optional `min`, `max`.
 *   - 'integer' : whole number. Optional `min`, `max`.
 *   - 'boolean' : true/false (also accepts 0/1).
 *   - 'date'    : ISO date string (YYYY-MM-DD).
 *   - 'json'    : string that parses as JSON (no further shape check).
 *   - 'enum'    : one of `values`.
 *
 * Each field can also be `nullable: true` (accepts null/empty-string-as-null).
 * Unknown keys are silently DROPPED, not rejected — this matches the
 * "trust nothing from the client" model: the controller decides what columns
 * exist, not the request body.
 */

const isFiniteNumber = (n) => typeof n === 'number' && Number.isFinite(n);

function coerceAndCheck(field, raw, schema) {
    if (raw === undefined) return { skip: true };
    if (schema.nullable && (raw === null || raw === '')) return { ok: true, value: null };

    switch (schema.type) {
        case 'string': {
            if (typeof raw !== 'string') return { error: `${field}: debe ser string` };
            const trimmed = raw.trim();
            if (!schema.allowEmpty && trimmed.length === 0) return { error: `${field}: no puede estar vacío` };
            if (schema.max && trimmed.length > schema.max) return { error: `${field}: máximo ${schema.max} caracteres` };
            return { ok: true, value: trimmed };
        }
        case 'number': {
            const n = typeof raw === 'string' ? Number(raw) : raw;
            if (!isFiniteNumber(n)) return { error: `${field}: debe ser número` };
            if (schema.min !== undefined && n < schema.min) return { error: `${field}: mínimo ${schema.min}` };
            if (schema.max !== undefined && n > schema.max) return { error: `${field}: máximo ${schema.max}` };
            return { ok: true, value: n };
        }
        case 'integer': {
            const n = typeof raw === 'string' ? Number(raw) : raw;
            if (!Number.isInteger(n)) return { error: `${field}: debe ser entero` };
            if (schema.min !== undefined && n < schema.min) return { error: `${field}: mínimo ${schema.min}` };
            if (schema.max !== undefined && n > schema.max) return { error: `${field}: máximo ${schema.max}` };
            return { ok: true, value: n };
        }
        case 'boolean': {
            if (raw === true || raw === 1 || raw === '1') return { ok: true, value: 1 };
            if (raw === false || raw === 0 || raw === '0') return { ok: true, value: 0 };
            return { error: `${field}: debe ser booleano` };
        }
        case 'date': {
            if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                return { error: `${field}: debe tener formato YYYY-MM-DD` };
            }
            return { ok: true, value: raw };
        }
        case 'json': {
            if (typeof raw !== 'string') return { error: `${field}: debe ser string JSON` };
            try { JSON.parse(raw); }
            catch { return { error: `${field}: JSON inválido` }; }
            if (schema.max && raw.length > schema.max) return { error: `${field}: JSON demasiado grande` };
            return { ok: true, value: raw };
        }
        case 'enum': {
            if (!Array.isArray(schema.values) || !schema.values.includes(raw)) {
                return { error: `${field}: valor no permitido` };
            }
            return { ok: true, value: raw };
        }
        default:
            return { error: `${field}: tipo de schema desconocido` };
    }
}

/**
 * Pick allowed keys from `body` according to `schema`, validating each.
 *
 * Returns `{ value, errors? }`:
 *   - value : object containing only the allowed, validated keys.
 *   - errors: array of error strings (only present if validation failed).
 *
 * Required keys missing from the body produce errors. Unknown keys in the
 * body are silently dropped.
 */
export function pickAndValidate(body, schema) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { errors: ['body inválido'] };
    }

    const value = {};
    const errors = [];

    for (const [field, fieldSchema] of Object.entries(schema)) {
        const raw = body[field];
        const result = coerceAndCheck(field, raw, fieldSchema);
        if (result.skip) {
            if (fieldSchema.required) errors.push(`${field}: requerido`);
            continue;
        }
        if (result.error) {
            errors.push(result.error);
            continue;
        }
        value[field] = result.value;
    }

    if (errors.length > 0) return { value, errors };
    return { value };
}

// ── Reusable schemas ─────────────────────────────────────────────────────────

export const ORDER_UPDATE_SCHEMA = {
    items:           { type: 'json',    max: 60_000 },
    deposit:         { type: 'number',  min: 0, max: 99_999_999 },
    paid:            { type: 'boolean' },
    paidAt:          { type: 'date',    nullable: true },
    paymentMethod:   { type: 'enum',    values: ['Efectivo', 'Plataforma'] },
    collectedBy:     { type: 'string',  max: 100, nullable: true },
    isAbandoned:     { type: 'boolean' },
    abandonedAt:     { type: 'string',  max: 32, nullable: true },
    abandonedBy:     { type: 'string',  max: 100, nullable: true },
    abandonReason:   { type: 'string',  max: 1000, nullable: true, allowEmpty: true },
    clientId:        { type: 'integer', min: 1 },
    shopId:          { type: 'integer', min: 1 },
};

export const CLIENT_UPDATE_SCHEMA = {
    premises:    { type: 'string', max: 50 },
    clientName:  { type: 'string', max: 100 },
    mall:        { type: 'string', max: 100 },
    phoneNumber: { type: 'string', max: 30, nullable: true, allowEmpty: true },
};

export const PRODUCT_UPDATE_SCHEMA = {
    productName: { type: 'string',  max: 200 },
    unitValue:   { type: 'integer', min: 0, max: 99_999_999 },
};
