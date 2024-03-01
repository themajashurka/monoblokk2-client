import { Request } from 'express'
import { TrayMenu } from './trayMenu'
import { baseFetch } from './baseFetch'
import os from 'os'
import fs from 'fs/promises'
import { PrinterObj } from './printer'

type Env = {
  locationName: string
  passcode: string
}

type SettingsData = {
  printers: PrinterObj[]
}

export class Settings {
  private trayMenu: TrayMenu
  imported!: Partial<SettingsData>

  constructor(trayMenu: TrayMenu) {
    this.trayMenu = trayMenu
  }

  static settingsPath = './settings.json'

  static getMacIp = () => {
    const data = Object.entries(os.networkInterfaces())
      .map((x) => x[1]!)
      .flat()
      .filter((x) => x.address.startsWith('192.168'))[0]!

    return { mac: data.mac, ip: data.address }
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
        Settings.getMacIp().mac,
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

      const settings = await baseFetch(
        Settings.getMacIp().mac,
        '/api/external/local-client/get-settings',
        {},
        this.trayMenu
      )

      this.imported = settings
      await this.getApiKey(env)
      this.syncImported()
      await Settings.writeSettings({
        passcode: this.trayMenu.passode,
        locationName: this.trayMenu.locationName,
        ...settings,
      })
      showPasscodeDialog = false
      return showPasscodeDialog
    } catch (error) {
      return showPasscodeDialog
    }
  }

  save = async (settingsData: Partial<SettingsData>) => {
    await baseFetch(
      Settings.getMacIp().mac,
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
  }
}
