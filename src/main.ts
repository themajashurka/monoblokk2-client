import { updateElectronApp } from 'update-electron-app'
updateElectronApp({
  updateInterval: '5 minutes',
})
import { app, BrowserWindow } from 'electron'
import path from 'path'
import _express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
const express = _express()
express.use(cors(), cookieParser())
const dev = !app.isPackaged
if (dev) process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'
import { endpoint } from './lib/endpoints'
import { usb } from 'usb'
import { TrayMenu } from './lib/trayMenu'
//@ts-ignore
import { config } from '@dotenvx/dotenvx'
config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(process.cwd(), '.env'),
})
import log from 'electron-log/node'
console.log = log.log
console.error = log.error
console.info = log.info
log.eventLogger.startLogging()

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

const appFolder = path.dirname(process.execPath)
const updateExe = path.resolve(appFolder, '..', 'Update.exe')
const exeName = path.basename(process.execPath)
app.setLoginItemSettings({
  openAtLogin: true,
  path: updateExe,
  args: [
    '--processStart',
    `"${exeName}"`,
    '--process-start-args',
    '"--hidden"',
  ],
})

const trayMenu = new TrayMenu(dev)

usb.on('attach', () => {
  trayMenu.refreshPrinters()
})
usb.on('detach', () => {
  trayMenu.refreshPrinters()
})

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
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
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    )
  }

  // Open the DevTools.
  if (dev) mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  try {
    await trayMenu.init()
    await trayMenu.make()
  } catch (error) {
    console.error(error)
  }

  endpoint.welcome(express)
  endpoint.setShiftPresent(express, trayMenu)
  endpoint.setShiftLeft(express, trayMenu)
  endpoint.getLocationName(express, trayMenu)

  express.listen(3000)
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  //app.quit();
})

// Create the Electron app and create the main window when it's ready
if (!dev) app.whenReady().then(createWindow)

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    if (!dev) createWindow()
  }
})

app.on('before-quit', async (e) => {
  e.preventDefault()
  await trayMenu.cctv.killService()
  app.exit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
