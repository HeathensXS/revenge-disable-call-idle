import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src", "index.js");
const source = fs.readFileSync(sourcePath, "utf8");

if (!source.startsWith("(")) {
  throw new Error("src/index.js must begin with '('");
}

const logs = [];
const vendetta = {
  logger: {
    log: (...a) => logs.push(["log", ...a]),
    warn: (...a) => logs.push(["warn", ...a])
  },
  metro: {
    modules: {},
    findByPropsAll: () => [],
    findByProps: () => undefined,
    findByName: () => undefined
  },
  patcher: {
    instead(name, obj, cb) {
      const original = obj[name];
      obj[name] = (...args) => cb(args, original.bind(obj));
      return () => { obj[name] = original; };
    }
  }
};

const plugin = Function("vendetta", "return " + source)(vendetta);

if (!plugin || typeof plugin.onLoad !== "function" || typeof plugin.onUnload !== "function") {
  throw new Error("Plugin does not expose onLoad/onUnload correctly");
}

plugin.onLoad();
plugin.onUnload();

console.log("PASS: source syntax/evaluation");
console.log("PASS: plugin lifecycle");
console.log("PASS: mock Revenge API load/unload");
