/**
 * ErrorBoundary — catches unhandled render errors in any child view.
 * Without this, any JS error in any view = white screen for the whole app.
 *
 * Must be a class component — React has no hook equivalent for componentDidCatch.
 */
import { Component } from "react";

const C = {
  cream:   "#FDFCF8",
  ink:     "#18120E",
  muted:   "#867A6F",
  saffron: "#C8551A",
  border:  "#EDE7DF",
  white:   "#FFFFFF",
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Store component stack for debugging
    this.setState({ info });
    // In production you would send to Sentry/Datadog here
    console.error("[Saarthi] Render error in", this.props.name || "view", error, info);
  }

  reset() {
    this.setState({ error: null, info: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const label = this.props.name || "this section";

    return (
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px", textAlign: "center",
        background: C.cream,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: "#FEF3EC", border: `2px solid ${C.saffron}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, marginBottom: 20,
        }}>
          🙏
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: C.ink, margin: "0 0 8px" }}>
          Something went wrong
        </p>
        <p style={{ fontSize: 14, color: C.muted, margin: "0 0 24px", lineHeight: 1.6, maxWidth: 280 }}>
          An unexpected error occurred in {label}. Your other tabs are unaffected.
        </p>
        <button
          onClick={() => this.reset()}
          style={{
            padding: "10px 24px", borderRadius: 12, border: "none",
            background: C.saffron, color: C.white,
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(200,85,26,0.28)",
          }}
        >
          Try again
        </button>
        {import.meta.env.DEV && this.state.error && (
          <details style={{ marginTop: 24, textAlign: "left", maxWidth: 400 }}>
            <summary style={{ fontSize: 12, color: C.muted, cursor: "pointer" }}>
              Error details (dev only)
            </summary>
            <pre style={{
              fontSize: 11, color: "#DC2626", background: "#FEF2F2",
              padding: 12, borderRadius: 8, marginTop: 8,
              overflow: "auto", maxHeight: 200, whiteSpace: "pre-wrap",
            }}>
              {this.state.error.toString()}
              {this.state.info?.componentStack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
