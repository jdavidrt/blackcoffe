import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import { Modal } from "antd";

// Reads (GET) give up after 20 s instead of leaving "Cargando..." spinning forever
// (docs/PERFORMANCE_AUDIT.md, QW4). Writes get no timeout on purpose: a payment that
// completes after the browser gave up would invite a retry and a duplicate deposit.
axios.interceptors.request.use((config) => {
  if (config.method === "get" && !config.timeout) config.timeout = 20000;
  return config;
});

// Pages show "No hay ..." when a load fails, which would read as "there is nothing".
// Tell the user the data didn't load instead (once, even if several requests fail).
let loadErrorShown = false;
axios.interceptors.response.use(undefined, (error) => {
  // status is undefined on timeouts and 0 on network errors (axios 0.27 attaches the raw XHR).
  const status = error.response?.status;
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
