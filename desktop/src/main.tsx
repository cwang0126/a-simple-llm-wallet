import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before first render to avoid flash
const saved = localStorage.getItem("llm-wallet-theme") ?? "dark";
document.documentElement.setAttribute("data-theme", saved);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
