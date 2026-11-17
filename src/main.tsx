import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
// Import for its side effect: starts listening for beforeinstallprompt before React mounts.
import "./hooks/useInstallPrompt";

// Only registers in production builds; autoUpdate swaps in new builds without a prompt.
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
