# DisableCallIdle for Revenge Classic (EXPERIMENTAL)

This is an experimental Android port inspired by Vencord's DisableCallIdle behavior.

## What it does
It attempts to locate Discord Android's call-idle handler at runtime and patch it so the
client does not disconnect an idle DM call after roughly 3 minutes.

## Important
- This is NOT guaranteed to work on every Discord Android build.
- Discord's mobile internals differ from desktop Vencord.
- If no compatible handler is found, the plugin intentionally does nothing rather than
  blindly patching unrelated code.
- A Discord update can break it.

## Install
Revenge Classic plugins are normally installed from a static URL. Easiest route:

1. Create a GitHub repository.
2. Upload `manifest.json` and `index.js` to the repository root.
3. Enable GitHub Pages for the repository:
   Settings -> Pages -> Deploy from branch -> main / root.
4. Wait for Pages to publish.
5. In Discord on Android:
   Settings -> Revenge -> Plugins -> +
6. Paste the URL to the published folder, e.g.
   `https://YOURNAME.github.io/YOUR-REPO/`
7. Enable the plugin and reload Discord.
8. Test by joining a DM call, having the other person leave, and waiting >3 minutes.

## Troubleshooting
If you are still disconnected, this Discord build does not expose the same handler.
Check Revenge's logs for `[DisableCallIdle]` messages.

If the log says:
`No compatible idle-call handler was found`
then the next step is to inspect the exact Discord build and adapt the module lookup.
