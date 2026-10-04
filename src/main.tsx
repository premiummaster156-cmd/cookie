import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "animate.css";
import "./styles.css";
import "./liquid-glass/styles/liquid-glass.css";
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);