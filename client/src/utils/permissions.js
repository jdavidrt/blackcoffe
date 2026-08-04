/**
 * User privileges - centralizes the userName-based menu/route gating.
 *
 * The `users` table has no roles column (id, createdAt, userName, pass), so
 * privileges are keyed off the userName stored in localStorage at login
 * (LoginForm.jsx). Keep every privilege check here instead of comparing
 * userName string literals inline.
 */
import { MALLS } from './mallUtils';

/** Kiosk account - gets the reduced navbar menu. */
export const KIOSK_USER = 'Black coffe Unilago';

/**
 * Users limited to specific malls inside the "Cobrar" section.
 * Everything else about their privileges is unchanged.
 *
 * Each value is the complete allowlist for that user - either an array of
 * malls or a single mall. Note that a plain object can't hold the same key
 * twice (`{ Unilago: A, Unilago: B }` silently keeps only B), so multiple
 * malls MUST be written as one array:
 *
 *   const COLLECT_MALL_RESTRICTIONS = {
 *     Unilago: [MALLS.OTROS, MALLS.UNILAGO],  // two malls
 *     AltaTec: MALLS.ALTA_TECNOLOGIA,         // one mall (shorthand)
 *   };
 *
 * A user with no entry here is unrestricted (sees all four malls).
 * An entry of `[]` means the opposite: no "Cobrar" access at all.
 */
const COLLECT_MALL_RESTRICTIONS = {
  Unilago: [MALLS.OTROS, MALLS.UNILAGO],
};

export const getCurrentUser = () => localStorage.getItem('user') || '';

export const isKioskUser = (user = getCurrentUser()) => user === KIOSK_USER;

/**
 * Every mall this user may collect from, or null when unrestricted.
 * Single-mall entries are normalized to an array.
 */
export const getAllowedCollectMalls = (user = getCurrentUser()) => {
  const allowed = COLLECT_MALL_RESTRICTIONS[user];
  if (allowed === undefined) return null;
  return Array.isArray(allowed) ? allowed : [allowed];
};

/**
 * Where to send a restricted user who lands on a mall they can't collect
 * from - their first allowed mall, or null when they have none.
 */
export const getDefaultCollectMall = (user = getCurrentUser()) => {
  const allowedMalls = getAllowedCollectMalls(user);
  if (!allowedMalls) return null;
  return allowedMalls.length > 0 ? allowedMalls[0] : null;
};

/**
 * Whether this user may open the collection view for a given mall.
 */
export const canCollectMall = (mall, user = getCurrentUser()) => {
  const allowedMalls = getAllowedCollectMalls(user);
  return !allowedMalls || allowedMalls.includes(mall);
};
