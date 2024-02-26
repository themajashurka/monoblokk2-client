import { updateElectronApp } from "update-electron-app";
updateElectronApp({
  updateInterval: "5 minutes",
});
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  MenuItem,
  nativeImage,
} from "electron";
import path from "path";
import { getLocalDevices } from "./lib/refreshLocalDevices";
import _express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
const express = _express();
express.use(cors(), cookieParser());
let isDev = false;
import("electron-is-dev").then((_isDev) => {
  if (_isDev) process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
  isDev = _isDev as any;
});
import { endpoint } from "./lib/endpoints";

import tty from "node:tty";
import { gt } from "./lib/getPrinters";

const users: { ip: string; name: string }[] = [];
let currentPrinter = "BIXOLON_SRP_350III";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    movable: false,
    maximizable: false,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    roundedCorners: false,
    minimizable: false,
    width: 600,
    height: 350,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
let tray: Tray = null;
app.on("ready", async () => {
  if (!isDev) createWindow();
  tray = new Tray(nativeImage.createFromPath("./M.png"));

  const makeContextMenu = (
    userData: { ip: string; mac: string }[],
    printerData: any[]
  ) => {
    const printers = new MenuItem({
      type: "submenu",
      label: "Nyomtatók",
      submenu: [
        ...printerData.map((x) => ({
          label: x.name,
          enabled: x.status !== "IDLE",
          type: "radio" as const,
          checked: x.name === currentPrinter,
          //submenu: [{ label: "Tesztnyomtatás" }],
        })),
      ],
    });
    const users = new MenuItem({
      type: "submenu",
      label: "Felhasználók",
      submenu: [
        ...userData.map((x) => ({ label: `IP: ${x.ip} MAC: ${x.mac}` })),

        /*  { type: "separator" },
        {
          label: "Frissítés",
          click: async () => makeContextMenu(await getLocalDevices()),
        }, */
      ],
    });
    const quit = new MenuItem({ label: "Kilépés", click: () => app.quit() });

    const contextMenu = Menu.buildFromTemplate([
      printers,
      users,
      { type: "separator" },
      quit,
    ]);
    tray.setContextMenu(contextMenu);

    /* if (process.platform === "win32") {
      tray.on("click", (event, bounds) => {
        tray.popUpContextMenu();
      });
    } */
  };
  makeContextMenu([], gt());

  tray.setToolTip("Monoblokk kliens");

  endpoint.shiftStatePresent(express, makeContextMenu, users, isDev);
  endpoint.shiftStateLeft(express, makeContextMenu, users, isDev);

  /* const clearLastLine = () => {
    process.stdout.moveCursor(0, -1); // up one line
    process.stdout.clearLine(1); // from cursor to end
  };

  const ws = new tty.WriteStream(0);
  for (let i = 0; i < 10; i++) {
    clearLastLine();
    console.log("------------" + i + "--------------");
    await new Promise((res) => setTimeout(() => res(""), 100));
  } */

  express.listen(3000);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  //app.quit();
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    if (!isDev) createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
