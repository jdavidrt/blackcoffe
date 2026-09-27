import { useEffect, useState } from "react";
import { useNetworkStatus } from "../utils/network";

// Bottom bar that tells staff on mobile data that a wait or a failure is the signal's fault,
// not the app's. States come from the axios interceptors in utils/network.js.
const STATES = {
  offline: { color: "#b91c1c", text: "📵 Sin señal. Esperando conexión…" },
  retrying: { color: "#c2410c", text: "📶 Señal débil: reintentando…" },
  slow: { color: "#a16207", text: "📶 La señal está lenta. Esperando respuesta…" },
  back: { color: "#15803d", text: "✓ Conexión restablecida" },
};
const BACK_FOR = 2500;

function ConnectionBanner() {
  const { online, slow, retrying, recoveredAt } = useNetworkStatus();
  const problem = !online ? "offline" : retrying ? "retrying" : slow ? "slow" : null;
  const [now, setNow] = useState(Date.now);
  const showBack = !problem && now - recoveredAt < BACK_FOR;

  // Re-render once the "restablecida" message has been up long enough.
  useEffect(() => {
    setNow(Date.now());
    const timer = setTimeout(() => setNow(Date.now()), BACK_FOR);
    return () => clearTimeout(timer);
  }, [recoveredAt]);

  const state = STATES[problem || (showBack && "back")];
  if (!state) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 900, // above page overlays, below antd modals (1000)
        background: state.color, color: "#fff", padding: "10px 16px",
        textAlign: "center", fontWeight: 600, fontSize: 15,
      }}
    >
      {state.text}
    </div>
  );
}

export default ConnectionBanner;
