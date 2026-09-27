(vendetta => {
  const TAG = "[DisableCallIdle]";
  const unpatches = [];
  let patched = false;

  const log = (...args) => {
    try { vendetta.logger?.log?.(TAG, ...args); } catch {}
    try { console.log(TAG, ...args); } catch {}
  };

  const warn = (...args) => {
    try { vendetta.logger?.warn?.(TAG, ...args); } catch {}
    try { console.warn(TAG, ...args); } catch {}
  };

  const patchInstead = (obj, method, replacement) => {
    if (!obj || typeof obj[method] !== "function") return false;

    try {
      const unpatch = vendetta.patcher.instead(method, obj, (args, original) => {
        return replacement.call(obj, args, original);
      });
      if (typeof unpatch === "function") unpatches.push(unpatch);
      log("Patched", method);
      return true;
    } catch (e) {
      warn("Failed to patch", method, e);
      return false;
    }
  };

  const tryTarget = (candidate) => {
    if (!candidate) return false;

    const targets = [
      candidate,
      candidate.default,
      candidate.prototype,
      candidate.default?.prototype
    ].filter(Boolean);

    for (const t of targets) {
      if (typeof t.handleIdleUpdate === "function") {
        if (patchInstead(t, "handleIdleUpdate", () => {
          log("Blocked handleIdleUpdate()");
          return undefined;
        })) {
          patched = true;
        }
      }

      // Some Discord builds may expose a differently named call-idle handler.
      for (const key of Object.keys(t)) {
        if (!/idle/i.test(key) || typeof t[key] !== "function") continue;
        if (!/call|voice|update|timeout/i.test(key)) continue;
        if (key === "handleIdleUpdate") continue;

        if (patchInstead(t, key, (args, original) => {
          // Only suppress zero/one-argument idle callbacks. Avoid broadly
          // blocking unrelated "idle" methods.
          if (args.length <= 1) {
            log("Blocked probable idle-call handler:", key);
            return undefined;
          }
          return original(...args);
        })) {
          patched = true;
        }
      }
    }

    return patched;
  };

  const findCandidates = () => {
    const metro = vendetta.metro || {};
    const list = [];

    const safe = (fn) => {
      try {
        const v = fn();
        if (v) list.push(v);
      } catch {}
    };

    if (typeof metro.findByProps === "function") {
      safe(() => metro.findByProps("handleIdleUpdate"));
      safe(() => metro.findByProps("idleTimeout"));
      safe(() => metro.findByProps("handleIdleUpdate", "idleTimeout"));
    }

    if (typeof metro.findByName === "function") {
      for (const name of [
        "CallStore",
        "PrivateChannelCallStore",
        "VoiceStateStore",
        "RTCConnectionStore"
      ]) safe(() => metro.findByName(name));
    }

    return list;
  };

  return {
    onLoad() {
      log("Loading experimental Android DisableCallIdle port...");
      const candidates = findCandidates();

      for (const c of candidates) tryTarget(c);

      if (!patched) {
        warn(
          "No compatible idle-call handler was found in this Discord build. " +
          "The plugin loaded safely, but it is not active."
        );
      } else {
        log("Active. Test by remaining alone in a DM call for longer than 3 minutes.");
      }
    },

    onUnload() {
      while (unpatches.length) {
        try { unpatches.pop()?.(); } catch {}
      }
      patched = false;
      log("Unloaded and restored original methods.");
    }
  };
})