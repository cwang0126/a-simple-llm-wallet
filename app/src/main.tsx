import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Apply saved theme before first render to avoid flash
const saved = localStorage.getItem("llm-wallet-theme") ?? "dark";
document.documentElement.setAttribute("data-theme", saved);

// Hide window on close instead of quitting — keeps tray icon alive
getCurrentWindow().onCloseRequested((event) => {
  event.preventDefault();
  getCurrentWindow().hide();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
