import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import { Modal } from "antd";
import { API_CONFIG } from "./utils/config";

// Reads (GET) give up after 20 s instead of leaving "Cargando..." spinning forever
// (docs/PERFORMANCE_AUDIT.md, QW4). Writes get no timeout on purpose: a payment that
// completes after the browser gave up would invite a retry and a duplicate deposit.
axios.interceptors.request.use((config) => {
  if (config.method === "get" && !config.timeout) config.timeout = 20000;
  config.startedAt = Date.now();
  return config;
});

// Timeouts, dropped connections and Render 502/503s never reach a controller, so the
// server can't email about them on its own: report them to POST /clientError. A plain
// 500 already emailed from the controller's catch. If the report can't get through
// either (server down), keep it and resend on the next page load, e.g. "Reintentar".
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
// Tell the user the data didn't load instead (once, even if several requests fail).
let loadErrorShown = false;
axios.interceptors.response.use(undefined, (error) => {
  // status is undefined on timeouts and 0 on network errors (axios 0.27 attaches the raw XHR).
  const status = error.response?.status;
  if (error.config && (!status || status > 500)) {
    reportFailure({
      error: status ? `HTTP ${status}` : error.message, // "timeout of 20000ms exceeded" / "Network Error"
      request: `${error.config.method?.toUpperCase()} ${error.config.url}`,
      elapsedMs: Date.now() - error.config.startedAt,
      occurredAt: new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" }),
      page: window.location.pathname,
      user: localStorage.getItem("user"),
      online: navigator.onLine,
      connection: navigator.connection?.effectiveType,
      userAgent: navigator.userAgent,
    });
  }
  const failedRead = error.config?.method === "get" && (!status || status >= 500);
  if (failedRead && !loadErrorShown) {
    loadErrorShown = true;
    Modal.error({
      title: "No se pudieron cargar los datos",
      content: "El servidor no respondió. La información en pantalla puede estar incompleta.",
      okText: "Reintentar",
      okButtonProps: { style: { backgroundColor: "#1677ff", borderColor: "#1677ff", color: "#fff" } },
      onOk: () => window.location.reload(),
    });
  }
  return Promise.reject(error);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode className="bg-slate-200 h-screen">
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
