import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last line of defence for the admin portal.
 *
 * `src/main.tsx` used to mount `<AdminApp />` bare, so any throw during render,
 * in a lifecycle method, or while a child resolved left React with an empty
 * `#root` and the operator with a silent white screen. The boot shell in
 * `index.html` only covers *load* failures (bundle 404, blocked network) — it is
 * already gone by the time the tree renders. This boundary covers the other half.
 *
 * Styles are inline on purpose: a crash can originate in a stylesheet-dependent
 * layout, and the recovery screen must never depend on the bundle that failed.
 */

interface AdminErrorBoundaryProps {
  children: ReactNode;
}

interface AdminErrorBoundaryState {
  error: Error | null;
}

const shellStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483646,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "#f7f7f8",
  fontFamily: "'PingFang SC','Hiragino Sans GB','Microsoft YaHei',system-ui,sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  textAlign: "center",
};

const buttonStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "9px 22px",
  fontSize: 13,
  fontWeight: 600,
  color: "#fff",
  background: "#8B5CF6",
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
};

const codeStyle: React.CSSProperties = {
  marginTop: 14,
  fontFamily: "Menlo,monospace",
  fontSize: 11,
  lineHeight: 1.5,
  color: "#8a8a94",
  wordBreak: "break-all",
};

export class AdminErrorBoundary extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // A crash during the FIRST render means <DismissBootShell> never commits its
    // effect, so the inline shell would stay on top of this recovery screen.
    document.getElementById("boot")?.remove();
    console.error("[admin] render crashed", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopy = () => {
    const { error } = this.state;
    const detail = `${error?.name ?? "Error"}: ${error?.message ?? "unknown"}\n${window.location.href}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(detail).catch(() => undefined);
    }
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    return (
      <div style={shellStyle} role="alert">
        <div style={cardStyle}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#1f1f23",
              letterSpacing: "0.02em",
            }}
          >
            页面出错了
          </div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.65, color: "#6b6b76" }}>
            这个页面的渲染中断了，刷新通常可以恢复。如果反复出现，请把下面的信息发给技术同学。
          </div>
          <div style={codeStyle}>
            {error.name}: {error.message}
          </div>
          <div>
            <button type="button" style={buttonStyle} onClick={this.handleReload}>
              重新加载
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, marginLeft: 10, background: "#fff", color: "#4b4b55", border: "1px solid #d8d8e0" }}
              onClick={this.handleCopy}
            >
              复制错误信息
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default AdminErrorBoundary;
