# Revenge DisableCallIdle - Complete Project

## IMPORTANT: where to run npm commands

Open PowerShell in THIS folder — the folder containing:

- package.json
- build.mjs
- check.mjs
- manifest.template.json
- src\
- dist\

Do NOT run npm commands inside `src` or `dist`.

Example:

```powershell
cd C:\Users\DaKourage\Desktop\revenge-disable-call-idle-complete
npm install
npm run check
npm run build
```

There are no external npm dependencies in this project. `npm install` is optional, but safe to run.

## What the commands do

`npm run check`
- evaluates the plugin source
- checks onLoad/onUnload
- runs it against a small mock Revenge API

`npm run build`
- copies src/index.js into dist/index.js
- calculates the script hash
- creates dist/manifest.json

## Files you upload to GitHub

ONLY upload the contents of `dist/` to the root of your GitHub Pages repository:

- dist/index.js
- dist/manifest.json

Your GitHub repository should end up like:

```text
revenge-disable-call-idle/
├── index.js
└── manifest.json
```

Your Revenge install URL should then be:

```text
https://heathensxs.github.io/revenge-disable-call-idle/
```

## Prebuilt output

This ZIP already contains a prebuilt `dist/` folder too.

So if you do not want to build anything, you can upload:

- dist/index.js
- dist/manifest.json

immediately.

## Runtime limitation

The package and loader format can be validated on a PC, but Discord Android's internal call-idle
module names can vary by app build. If the plugin installs but the call still ends after ~3 minutes,
the next step is to inspect the Revenge logs and adapt the runtime module lookup.
