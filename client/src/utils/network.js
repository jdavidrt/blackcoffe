import axios from "axios";
import { Modal } from "antd";
import { useSyncExternalStore } from "react";
import { API_CONFIG } from "./config";

// Staff use the app on mobile data across the malls, where the signal drops for a few seconds at
// a time (docs/PERFORMANCE_AUDIT.md §10). A request that is safe to resend gets two more tries
// before the user sees an error, and ConnectionBanner says meanwhile that the cause is the signal.
const GET_TIMEOUT = 15000;
const WRITE_TIMEOUT = 20000;
const RETRY_DELAYS = [1000, 3000]; // pause before the 2nd and the 3rd attempt
const SLOW_AFTER = 4000; // "la señal está lenta" once a request has waited this long
const OFFLINE_WAIT_MAX = 60000; // while offline, hold a retry until the signal is back (at most this)

// Writes are resent only when a resend can't apply them twice: POST /order and POST /deposits carry
// an Idempotency-Key the server remembers; PUT /order/:id/delivered sets a state, it doesn't flip it.
// Other writes (Editar Orden, deleting a deposit...) keep no timeout and no retry: if the answer is
// lost, the user decides. Use a new key per intent and reuse it when the user repeats that intent.
export const newRequestKey = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const idempotent = (key) => ({ retry: true, headers: { "Idempotency-Key": key } });

// ── Connection status, read by ConnectionBanner ─────────────────────────────
// recoveredAt: when a retried request finally got through (or the signal came back with nothing
// pending), so the banner can say "Conexión restablecida"; a request that gives up clears it.
let status = { online: navigator.onLine, slow: 0, retrying: 0, recoveredAt: 0 };
const listeners = new Set();
const update = (patch) => {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
};
const bump = (key, delta) => update({ [key]: Math.max(0, status[key] + delta) });
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
window.addEventListener("online", () => update({ online: true, ...(!status.retrying && { recoveredAt: Date.now() }) }));
window.addEventListener("offline", () => update({ online: false }));
export const useNetworkStatus = () => useSyncExternalStore(subscribe, () => status);

// "Reintentar" remounts the app (main.jsx) instead of reloading the page: a reload with no signal
// lands on the browser's offline page and the app is gone.
const RETRY_EVENT = "app:retry";
export const onRetry = (fn) => {
  window.addEventListener(RETRY_EVENT, fn);
  return () => window.removeEventListener(RETRY_EVENT, fn);
};
export const reloadData = () => window.dispatchEvent(new Event(RETRY_EVENT));

const waitForSignal = (ms) =>
  new Promise((resolve) => {
    const go = () => setTimeout(resolve, ms);
    if (navigator.onLine) return go();
    const onOnline = () => {
      clearTimeout(giveUp);
      window.removeEventListener("online", onOnline);
      go();
    };
    const giveUp = setTimeout(onOnline, OFFLINE_WAIT_MAX);
    window.addEventListener("online", onOnline);
  });

// Timeouts, dropped connections and Render 502/503s never reach a controller, so the server can't
// email about them on its own: report them to POST /clientError. A plain 500 already emailed from
// the controller's catch. If the report can't get through either, keep it and resend on next load.
const PENDING_REPORTS = "pendingErrorReports";
function reportFailure(report) {
  fetch(`${API_CONFIG.RENDER_SERVER}/clientError`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  })
    .then((res) => { if (!res.ok) throw new Error(res.status); })
    .catch(() => {
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_REPORTS) || "[]");
        localStorage.setItem(PENDING_REPORTS, JSON.stringify([...pending, report].slice(-20)));
      } catch {}
    });
}
try {
  const pending = JSON.parse(localStorage.getItem(PENDING_REPORTS) || "[]");
  localStorage.removeItem(PENDING_REPORTS);
  pending.forEach((report) => reportFailure({ ...report, sentLate: true }));
} catch {}

// Pages show "No hay ..." when a load fails, which would read as "there is nothing".
// Tell the user the data didn't load, and why (once, even if several requests fail).
let loadErrorShown = false;
function showLoadError(noAnswer) {
  if (loadErrorShown) return;
  loadErrorShown = true;
  Modal.error({
    title: noAnswer ? "Señal débil o sin conexión" : "No se pudieron cargar los datos",
    content: noAnswer
      ? "Los datos no cargaron después de 3 intentos. Casi siempre es por la señal del celular: " +
        "muévase a un lugar con mejor señal (o conéctese a Wi-Fi) y toque Reintentar. " +
        "La información en pantalla puede estar incompleta."
      : "El servidor tuvo un problema. Espere un momento y toque Reintentar. " +
        "La información en pantalla puede estar incompleta.",
    okText: "Reintentar",
    okButtonProps: { style: { backgroundColor: "#1677ff", borderColor: "#1677ff", color: "#fff" } },
    onOk: () => {
      loadErrorShown = false;
      reloadData();
    },
  });
}

const settle = (config) => {
  clearTimeout(config.slowTimer);
  if (config.isSlow) {
    config.isSlow = false;
    bump("slow", -1);
  }
};

axios.interceptors.request.use((config) => {
  if (!config.timeout && (config.method === "get" || config.retry)) {
    config.timeout = config.method === "get" ? GET_TIMEOUT : WRITE_TIMEOUT;
  }
  config.startedAt = config.startedAt || Date.now(); // first attempt, kept across retries
  config.slowTimer = setTimeout(() => {
    config.isSlow = true;
    bump("slow", 1);
  }, SLOW_AFTER);
  return config;
});

axios.interceptors.response.use(
  (response) => {
    settle(response.config);
    if (response.config.attempt) update({ recoveredAt: Date.now() });
    return response;
  },
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);
    settle(config);

    // status is undefined on timeouts and 0 on network errors (axios 0.27 attaches the raw XHR).
    const status = error.response?.status;
    const noAnswer = !status;
    const attempt = config.attempt || 0;
    const resend = config.method === "get" ? noAnswer || status >= 500 : config.retry && (noAnswer || status >= 502);
    if (resend && attempt < RETRY_DELAYS.length) {
      bump("retrying", 1);
      try {
        await waitForSignal(RETRY_DELAYS[attempt]);
        return await axios({ ...config, attempt: attempt + 1 });
      } finally {
        bump("retrying", -1);
      }
    }

    update({ recoveredAt: 0 });
    if (noAnswer || status > 500) {
      reportFailure({
        error: status ? `HTTP ${status}` : error.message, // "timeout of 15000ms exceeded" / "Network Error"
        request: `${config.method?.toUpperCase()} ${config.url}`,
        attempts: attempt + 1,
        elapsedMs: Date.now() - config.startedAt, // since the first attempt
        occurredAt: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
        page: window.location.pathname,
        user: localStorage.getItem("user"),
        online: navigator.onLine,
        connection: navigator.connection?.effectiveType,
        rttMs: navigator.connection?.rtt, // effectiveType reads "4g" for almost any link; these don't
        downlinkMbps: navigator.connection?.downlink,
        userAgent: navigator.userAgent,
      });
    }
    if (config.method === "get" && (noAnswer || status >= 500)) showLoadError(noAnswer);
    return Promise.reject(error);
  }
);
