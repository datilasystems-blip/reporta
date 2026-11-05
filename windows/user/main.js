// REPORTA REPORTA User — Electron main process
const { app, BrowserWindow, shell, session } = require("electron");
const path = require("path");

// Security: no node integration in renderer, context isolation on.
function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360,
    title: "REPORTA User",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  // Open external links (tel:, https:) in the OS browser, never in-app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^tel:/.test(url)) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "allow" };
  });
  win.loadFile(path.join(__dirname, "www", "index.html"));
}
app.whenReady().then(() => {
  // Deny insecure mixed content; only https/file allowed
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, "X-Frame-Options": ["DENY"] } });
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
