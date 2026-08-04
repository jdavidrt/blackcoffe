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
 * Users limited to a single mall inside the "Cobrar" section.
 * Everything else about their privileges is unchanged.
 */
const COLLECT_MALL_RESTRICTIONS = {
  Unilago: MALLS.OTROS, Unilago: MALLS.UNILAGO,
};

export const getCurrentUser = () => localStorage.getItem('user') || '';

export const isKioskUser = (user = getCurrentUser()) => user === KIOSK_USER;

/**
 * The only mall this user may collect from, or null when unrestricted.
 */
export const getAllowedCollectMall = (user = getCurrentUser()) =>
  COLLECT_MALL_RESTRICTIONS[user] || null;

/**
 * Whether this user may open the collection view for a given mall.
 */
export const canCollectMall = (mall, user = getCurrentUser()) => {
  const allowedMall = getAllowedCollectMall(user);
  return !allowedMall || mall === allowedMall;
};
