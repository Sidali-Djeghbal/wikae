import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { startThemeSync } from "@/lib/theme";
import { migrateStorage } from "@/lib/storage";

// Migrate legacy etude.* and wikaa.* storage keys to wikae.*
migrateStorage();

// index.html already applied the cached theme; this confirms it with the server.
startThemeSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
