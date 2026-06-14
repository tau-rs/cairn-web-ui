import { useEffect, useRef, useState } from "react";
import {
  BROKER_HANDSHAKE_TIMEOUT_MS,
  DEFAULT_IFRAME_HEIGHT,
  type PluginCapability,
} from "../../client/pluginTier3";
import { createBroker } from "../../client/pluginBroker";
import type { BrokerHost } from "../../client/pluginBrokerHost";

type Phase = "handshaking" | "ready" | "error";

/**
 * Mounts an untrusted plugin's HTML in a null-origin sandboxed iframe and owns
 * the per-frame broker for its whole lifetime. The sandbox attr is hard-coded
 * (never allow-same-origin) so the frame stays opaque-origin + network-blocked.
 *
 * Callers MUST pass stable `granted` / `pluginCommands` / `host` references
 * (memoized Sets, singleton host): they are effect deps, so a fresh identity on
 * every parent render would remount the iframe and re-handshake each time.
 */
export function IframeHost({
  plugin,
  html,
  height,
  granted,
  pluginCommands,
  host,
  handshakeTimeoutMs = BROKER_HANDSHAKE_TIMEOUT_MS,
}: {
  plugin: string;
  html: string;
  height: number | null;
  granted: ReadonlySet<PluginCapability>;
  pluginCommands: ReadonlySet<string>;
  host: BrokerHost;
  handshakeTimeoutMs?: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [phase, setPhase] = useState<Phase>("handshaking");
  // Bumped on retry to force the effect to tear down the old broker and remount
  // against the freshly re-mounted iframe (the effect can't key off `ref`, and
  // the other deps are unchanged on retry).
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const frame = ref.current?.contentWindow;
    if (!frame) return;

    const broker = createBroker({
      frame,
      plugin,
      granted,
      pluginCommands,
      host,
    });

    // Forward active-note change events to the frame (for activeNote.subscribe) —
    // ONLY if the plugin holds the read grant, so pushed events can't leak note
    // content past the capability gate.
    const unsubNote = granted.has("activeNote.read")
      ? host.subscribeActiveNote(() => {
          const note = host.activeNote();
          frame.postMessage(
            { t: "event", topic: "activeNote", payload: note },
            "*",
          );
        })
      : () => {};

    // Handshake: the frame posts {t:"req",method:"__handshake"}; we ack {t:"ready"}.
    const onHandshake = (e: MessageEvent) => {
      if (e.source !== frame) return;
      const d = e.data as { t?: string; method?: string } | null;
      if (d?.t === "req" && d.method === "__handshake") {
        setPhase("ready");
        frame.postMessage({ t: "ready", capabilities: [...granted] }, "*");
      }
    };
    window.addEventListener("message", onHandshake);

    const timer = window.setTimeout(() => {
      setPhase((p) => (p === "handshaking" ? "error" : p));
    }, handshakeTimeoutMs);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onHandshake);
      unsubNote();
      broker.dispose();
    };
    // Re-mount the frame (and broker) whenever identity/grant/html changes, or
    // when retry bumps `retryKey`.
  }, [
    plugin,
    html,
    granted,
    pluginCommands,
    host,
    handshakeTimeoutMs,
    retryKey,
  ]);

  if (phase === "error") {
    return (
      <button
        type="button"
        onClick={() => {
          setPhase("handshaking");
          setRetryKey((k) => k + 1);
        }}
        className="text-xs text-faint italic hover:text-muted"
      >
        plugin didn&apos;t start — retry
      </button>
    );
  }

  return (
    <iframe
      ref={ref}
      title={`plugin:${plugin}`}
      sandbox="allow-scripts"
      srcDoc={html}
      style={{
        width: "100%",
        height: `${height ?? DEFAULT_IFRAME_HEIGHT}px`,
        border: "none",
      }}
    />
  );
}
