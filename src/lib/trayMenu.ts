import { Menu, MenuItem, Tray, app, dialog, nativeImage } from 'electron'
import { Printer } from './printer'
import path from 'path'
import { Settings } from './settings'
import fs from 'fs/promises'
import { baseFetch } from './baseFetch'

type Users = { ip: string; name: string }[]

export class TrayMenu {
  printers: Printer[]
  private users: Users
  private refreshPrinterInterval = 5000
  apiKey: string = process.env.APIKEY_EXTERNAL_SCHEDULE!
  passode!: string
  locationName!: string
  dev: boolean
  private showPasscodeDialog!: boolean

  settings: Settings

  public set setPrinters(p: Printer[]) {
    this.printers = p
    this.settings.syncImported()
    this.make()
  }

  public set setUsers(u: Users) {
    this.users = u
    this.make()
  }

  public get getPrinters() {
    return this.printers
  }

  public get getUsers() {
    return this.users
  }

  tray!: Tray

  constructor(dev: boolean) {
    this.dev = dev
    this.printers = Printer.getPrinters(this)
    this.users = []
    this.settings = new Settings(this)
  }

  init = async () => {
    this.showPasscodeDialog = await this.settings.get()
    this.tray = new Tray(nativeImage.createFromPath('./M.png'))
    this.tray.setToolTip('Monoblokk kliens')
    await baseFetch(
      Settings.getMacIp().mac,
      '/api/external/local-client/inform-ip',
      { ipAddress: Settings.getMacIp().ip },
      this
    )
  }

  make = async () => {
    const printersMenuItem = new MenuItem({
      type: 'submenu',
      label: 'Nyomtatók',
      submenu: [
        ...this.printers.map((x) => ({
          label: x.name,
          enabled: true,
          submenu:
            x.status !== 'refreshing'
              ? [
                  {
                    label: 'Tesztnyomtatás',
                    click: x.test,
                  },
                  {
                    label: 'Megjelölés alapértelmezettként',
                    click: () => {
                      x.setCurrent = true
                    },
                  },
                  {
                    label: 'Típus',
                    submenu: [
                      {
                        label: 'A4',
                        type: 'radio' as const,
                        checked: x.type === 'A4',
                        click: () => (x.setType = 'A4'),
                      },
                      {
                        label: 'Blokk',
                        type: 'radio' as const,
                        checked: x.type === 'Thermal',
                        click: () => (x.setType = 'Thermal'),
                      },
                      {
                        label: 'Címke',
                        type: 'radio' as const,
                        checked: x.type === 'Sticker',
                        click: () => (x.setType = 'Sticker'),
                      },
                    ],
                  },
                ]
              : undefined,
        })),
        ...(this.printers[0] && this.printers[0].status !== 'refreshing'
          ? [
              { type: 'separator' as const },
              {
                label: 'Frissítés',
                click: () => {
                  this.setPrinters = Printer.getPrinters(this)
                },
              },
            ]
          : []),
      ],
    })
    const usersMenuItem = new MenuItem({
      type: 'submenu',
      label: 'Felhasználók',
      submenu: [
        ...this.users.map((x) => ({ label: `IP: ${x.ip} MAC: ${x.name}` })),
      ],
    })
    const acquireApiKey = this.showPasscodeDialog
      ? [
          {
            label: 'Cégkód betöltése',
            click: this.acquireClientKey,
          },
          { label: 'json -> passcode, locationName', enabled: false },
        ]
      : []
    const locationName = this.locationName
      ? [
          {
            label: this.locationName,
            enabled: false,
          },
        ]
      : []
    const quit = new MenuItem({ label: 'Kilépés', click: () => app.quit() })

    ////////////////////////////////////////////////////
    const contextMenu = Menu.buildFromTemplate([
      printersMenuItem,
      usersMenuItem,
      { type: 'separator' },
      ...acquireApiKey,
      ...locationName,
      { type: 'separator' },
      quit,
      { label: 'v' + app.getVersion(), enabled: false },
    ])
    ////////////////////////////////////////////////////

    this.tray.setContextMenu(contextMenu)
  }

  refreshPrinters = () => {
    this.setPrinters = [new Printer('Frissítés...', 'refreshing', this)]
    setTimeout(
      () => (this.setPrinters = Printer.getPrinters(this)),
      this.refreshPrinterInterval
    )
  }

  acquireClientKey = async () => {
    const envPath = (
      await dialog.showOpenDialog({
        buttonLabel: 'Betölt',
        message: 'Cégkód betöltése',
        title: 'Cégkód betöltése',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: this.dev ? path.resolve(__dirname, '../../') : undefined,
      })
    ).filePaths

    if (envPath.length === 0) return

    await fs.unlink(Settings.settingsPath)
    const env = await Settings.loadEnvFile(this, envPath[0])
    if (!env) return
    await this.settings.getApiKey(env)
    this.make()
  }
}
