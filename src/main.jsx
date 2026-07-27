// ── Build identity — verify the RIGHT files are running ──────────────────────
// Open browser console (F12): this line proves which build is loaded.
const SAARTHI_BUILD = "2026-07-24-vedictime-auth-v9";
window.SAARTHI_BUILD = SAARTHI_BUILD;
console.log(`%c🕉️ SAARTHI build: ${SAARTHI_BUILD}`, "color:#D4621A;font-weight:bold;font-size:14px");

import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { AppProvider } from "@/context/AppContext";
import { LangProvider } from "@/i18n";
import { AuthProvider } from "@/context/AuthContext";
import "@/styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LangProvider>
      <AppProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </AppProvider>
    </LangProvider>
  </React.StrictMode>
);
