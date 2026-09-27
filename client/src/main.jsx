import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { onRetry } from "./utils/network"; // installs the axios timeouts, retries and failure reports
import ConnectionBanner from "./components/ConnectionBanner";

// "Reintentar" in the load-error dialog remounts App (every provider and page reloads its data)
// instead of reloading the page, which with no signal would end on the browser's offline page.
function Root() {
  const [mount, setMount] = useState(0);
  useEffect(() => onRetry(() => setMount((n) => n + 1)), []);
  return (
    <BrowserRouter>
      <App key={mount} />
      <ConnectionBanner />
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode className="bg-slate-200 h-screen">
    <Root />
  </React.StrictMode>
);
