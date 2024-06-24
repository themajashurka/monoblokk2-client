import { TrayMenu } from './trayMenu'
import { baseFetch } from './baseFetch'
import os from 'os'
import fs from 'fs/promises'
import type { PrinterObj } from './printer'
import type { CCTVObj } from './cctv'
import path from 'path'
import { app } from 'electron'

type Env = {
  locationName: string
  passcode: string
}

type SettingsData = {
  printers: PrinterObj[]
  cctvs: CCTVObj[]
  webrtcPort: number
}

export class Settings {
  private trayMenu: TrayMenu
  imported: Partial<SettingsData> = {}

  constructor(trayMenu: TrayMenu) {
    this.trayMenu = trayMenu
  }

  static settingsPath = path.join(app.getPath('userData'), 'settings.json')

  getMacIp = async () => {
    const promise = () =>
      new Promise<{ mac: string; ip: string }>((res, rej) => {
        const data = Object.entries(os.networkInterfaces())
          .map((x) => x[1]!)
          .flat()
          .filter((x) => x.address.startsWith('192.168'))[0]!

        try {
          return res({ mac: data.mac, ip: data.address })
        } catch (error) {
          console.error(
            'app needs to be a part of a local network, trying again...'
          )
          rej()
        }
      })

    const attempt = async () => {
      try {
        return await promise()
      } catch (e) {
        return new Promise<Awaited<ReturnType<typeof promise>>>((res) => {
          setTimeout(() => res(attempt()), 1000)
        })
      }
    }

    return await attempt()
  }

  static writeSettings = async (data: any) => {
    await fs.writeFile(Settings.settingsPath, JSON.stringify(data, null, ' '))
  }

  static loadEnvFile = async (trayMenu: TrayMenu, path: string) => {
    let env: Env
    try {
      env = JSON.parse(await fs.readFile(path, { encoding: 'utf8' }))
    } catch (error) {
      return
    }

    if (!env.locationName || !env.passcode) {
      return
    }
    trayMenu.locationName = env.locationName
    trayMenu.passode = env.passcode
    return env
  }

  getApiKey = async (env: Env) => {
    try {
      const settings = await baseFetch(
        (
          await this.getMacIp()
        ).mac,
        '/api/external/local-client/link-location',
        {
          locationName: env.locationName,
          passcode: env.passcode,
        },
        this.trayMenu
      )
      if (!settings.ok) throw new Error('unsuccessful linking')

      this.trayMenu.apiKey = settings.apiKey
      this.trayMenu.locationName = env.locationName
      this.trayMenu.passode = env.passcode

      await Settings.writeSettings(env)
    } catch (error) {
      console.error(error)
    }
  }

  getImported = async (env: Env) => {
    const settings = await baseFetch(
      (
        await this.getMacIp()
      ).mac,
      '/api/external/local-client/get-settings',
      {},
      this.trayMenu
    )

    return settings
  }

  get = async (): Promise<boolean> => {
    let showPasscodeDialog: boolean = true
    try {
      const env = await Settings.loadEnvFile(
        this.trayMenu,
        Settings.settingsPath
      )
      if (!env) {
        return showPasscodeDialog
      }
      await this.getApiKey(env)

      this.imported = await this.getImported(env)
      this.syncImported()
      await Settings.writeSettings({
        passcode: this.trayMenu.passode,
        locationName: this.trayMenu.locationName,
        ...this.imported,
      })
      showPasscodeDialog = false
      return showPasscodeDialog
    } catch (error) {
      return showPasscodeDialog
    }
  }

  save = async (settingsData: Partial<SettingsData>) => {
    await baseFetch(
      (
        await this.getMacIp()
      ).mac,
      '/api/external/local-client/set-settings',
      settingsData,
      this.trayMenu
    )
  }

  syncImported = () => {
    if (this.imported.printers) {
      this.imported.printers.map((p) => {
        const currentPrinter = this.trayMenu.printers.find(
          (_p) => _p.name === p.name
        )
        if (currentPrinter) {
          currentPrinter.type = p.type
        }
      })
    }
    if (this.imported.webrtcPort) {
      this.trayMenu.cctv.port = this.imported.webrtcPort
    }
    if (this.imported.cctvs) {
      this.trayMenu.cctv.setCameraLogins(this.imported.cctvs)
    }
  }
}
