(() => {
    const { patcher, metro, logger } = vendetta;

    const TAG = "[DisableCallIdle]";
    const unpatches = [];
    const patched = [];
    let active = false;

    const log = (...args) => {
        try { logger.log(TAG, ...args); } catch (_) {}
    };

    const warn = (...args) => {
        try { logger.warn(TAG, ...args); } catch (_) {}
    };

    function addUnpatch(fn) {
        if (typeof fn === "function") unpatches.push(fn);
    }

    function patchInstead(obj, method, replacement, label) {
        if (!obj || typeof obj[method] !== "function") return false;

        try {
            const undo = patcher.instead(method, obj, (args, original) => {
                try {
                    return replacement(args, original);
                } catch (error) {
                    warn("Patch callback failed for", label || method, error);
                    return original(...args);
                }
            });

            addUnpatch(undo);
            patched.push(label || method);
            log("Patched:", label || method);
            return true;
        } catch (error) {
            warn("Could not patch", label || method, error);
            return false;
        }
    }

    function patchIdleTimeout(timeout, ownerLabel) {
        if (!timeout || typeof timeout !== "object") return false;

        let didPatch = false;

        if (typeof timeout.start === "function") {
            didPatch = patchInstead(
                timeout,
                "start",
                () => {
                    log("Blocked idleTimeout.start()", ownerLabel || "");
                    return undefined;
                },
                (ownerLabel || "idleTimeout") + ".start"
            ) || didPatch;
        }

        if (typeof timeout.stop === "function") {
            didPatch = patchInstead(
                timeout,
                "stop",
                () => {
                    log("Blocked idleTimeout.stop()", ownerLabel || "");
                    return undefined;
                },
                (ownerLabel || "idleTimeout") + ".stop"
            ) || didPatch;
        }

        return didPatch;
    }

    function inspectObject(obj, label) {
        if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return false;

        let didPatch = false;
        const variants = [];

        const pushUnique = (value, suffix) => {
            if (!value || (typeof value !== "object" && typeof value !== "function")) return;
            if (variants.some(v => v.value === value)) return;
            variants.push({ value, suffix });
        };

        pushUnique(obj, "");
        try { pushUnique(obj.default, ".default"); } catch (_) {}
        try { pushUnique(obj.prototype, ".prototype"); } catch (_) {}
        try { pushUnique(obj.default && obj.default.prototype, ".default.prototype"); } catch (_) {}

        for (const entry of variants) {
            const target = entry.value;
            const targetLabel = label + entry.suffix;

            try {
                if (typeof target.handleIdleUpdate === "function") {
                    didPatch = patchInstead(
                        target,
                        "handleIdleUpdate",
                        () => {
                            log("Blocked handleIdleUpdate()", targetLabel);
                            return undefined;
                        },
                        targetLabel + ".handleIdleUpdate"
                    ) || didPatch;
                }
            } catch (_) {}

            try {
                if (target.idleTimeout) {
                    didPatch = patchIdleTimeout(
                        target.idleTimeout,
                        targetLabel + ".idleTimeout"
                    ) || didPatch;
                }
            } catch (_) {}
        }

        return didPatch;
    }

    function findDirectCandidates() {
        const results = [];
        const seen = new Set();

        const add = (value, label) => {
            if (!value || seen.has(value)) return;
            seen.add(value);
            results.push({ value, label });
        };

        const safe = (label, fn) => {
            try {
                const result = fn();
                if (Array.isArray(result)) {
                    result.forEach((item, i) => add(item, label + "[" + i + "]"));
                } else {
                    add(result, label);
                }
            } catch (_) {}
        };

        if (metro) {
            if (typeof metro.findByPropsAll === "function") {
                safe("findByPropsAll(handleIdleUpdate)", () =>
                    metro.findByPropsAll("handleIdleUpdate")
                );
                safe("findByPropsAll(idleTimeout)", () =>
                    metro.findByPropsAll("idleTimeout")
                );
            }

            if (typeof metro.findByProps === "function") {
                safe("findByProps(handleIdleUpdate)", () =>
                    metro.findByProps("handleIdleUpdate")
                );
                safe("findByProps(idleTimeout)", () =>
                    metro.findByProps("idleTimeout")
                );
            }

            if (typeof metro.findByName === "function") {
                for (const name of [
                    "PrivateChannelCallStore",
                    "CallStore",
                    "VoiceStateStore",
                    "RTCConnectionStore",
                    "VoiceConnectionStore"
                ]) {
                    safe("findByName(" + name + ")", () => metro.findByName(name));
                }
            }
        }

        return results;
    }

    function scanInitializedModules() {
        if (!metro || !metro.modules) return 0;

        let matches = 0;
        let scanned = 0;
        const MAX_MODULES = 20000;

        for (const id in metro.modules) {
            if (scanned++ >= MAX_MODULES) break;

            const module = metro.modules[id];
            if (!module || !module.isInitialized || module.hasError) continue;

            let exports;
            try {
                exports = module.publicModule && module.publicModule.exports;
            } catch (_) {
                continue;
            }

            if (!exports || exports === globalThis) continue;

            let interesting = false;
            try {
                interesting =
                    typeof exports.handleIdleUpdate === "function" ||
                    !!exports.idleTimeout ||
                    (exports.default && (
                        typeof exports.default.handleIdleUpdate === "function" ||
                        !!exports.default.idleTimeout
                    ));
            } catch (_) {}

            if (!interesting) continue;

            if (inspectObject(exports, "metro.modules[" + id + "]")) {
                matches++;
            }
        }

        log("Scanned initialized Metro modules:", scanned, "matching modules:", matches);
        return matches;
    }

    function apply() {
        if (active) return;

        log("Loading. Looking for Discord mobile idle-call handlers...");

        const direct = findDirectCandidates();
        log("Direct candidate modules:", direct.length);

        for (const candidate of direct) {
            inspectObject(candidate.value, candidate.label);
        }

        scanInitializedModules();

        active = patched.length > 0;

        if (active) {
            log(
                "Active. Installed",
                patched.length,
                "hook(s):",
                patched.join(", ")
            );
            log("Test by remaining alone in a DM call for more than 3 minutes.");
        } else {
            warn(
                "Plugin loaded correctly, but no compatible idle-call handler " +
                "was found in this Discord build. No behavior was changed."
            );
        }
    }

    function revert() {
        while (unpatches.length) {
            const undo = unpatches.pop();
            try { undo(); } catch (_) {}
        }

        patched.length = 0;
        active = false;
        log("Unloaded; all installed hooks were removed.");
    }

    return {
        onLoad() {
            apply();
        },
        onUnload() {
            revert();
        }
    };
})()