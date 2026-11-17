import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp";
import { AdminErrorBoundary } from "./components/AdminErrorBoundary";
import "./index.css";

/**
 * Removes the inline boot shell declared in index.html once React has committed.
 *
 * The shell has to outlive the module bootstrap: if this bundle never loads (404 on a
 * hashed asset after a deploy, blocked network, CSP), the watchdog in index.html turns
 * the shell into a retry screen instead of leaving an empty #root and a silent white
 * page. Deleting it any earlier would re-open exactly that hole.
 */
function DismissBootShell() {
  useEffect(() => {
    document.getElementById("boot")?.remove();
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <AdminErrorBoundary>
    <DismissBootShell />
    <AdminApp />
  </AdminErrorBoundary>,
);
