import { Menu, MenuItem, Tray, app, dialog, nativeImage } from 'electron'
import { Printer } from './printer'
import path from 'path'
import { Settings } from './settings'
import fs from 'fs/promises'
import { baseFetch } from './baseFetch'
import { Nettest } from './nettest'

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
  nettest: Nettest

  public set setPrinters(printers: Printer[]) {
    this.printers = printers
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
    this.nettest = new Nettest(this)
  }

  init = async () => {
    this.showPasscodeDialog = process.env.BYPASS_SERVER_COMMUNICATION
      ? false
      : await this.settings.get()
    this.tray = new Tray(nativeImage.createFromPath('./M.png'))
    this.tray.setToolTip('Monoblokk kliens')
    if (!process.env.BYPASS_SERVER_COMMUNICATION) {
      const ipMac = this.settings.getMacIp()
      await baseFetch(
        ipMac.mac,
        '/api/external/local-client/inform-ip',
        { ipAddress: ipMac.ip },
        this
      )
      if (!this.dev) this.nettest.beginTesting()
    }
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
    const nettest = new MenuItem({
      label: 'Internet sebesség',
      submenu: [
        ...(this.nettest.inProgress
          ? [{ label: 'Mérés folyamatban...' }]
          : [
              {
                label: 'Mérés most',
                click: () => this.nettest.testAndSubmit(),
              },
            ]),
        ...(this.nettest.basicResults
          ? [
              { type: 'separator' as const },
              ...(this.nettest.lastMeasurement
                ? [
                    {
                      enabled: false,
                      label: `Utolsó mérés: ${Nettest.parseDate(
                        this.nettest.lastMeasurement
                      )}`,
                    },
                  ]
                : []),
              {
                enabled: false,
                label: `Letöltés: ${this.nettest.basicResults.downloadSpeedInMbps.toFixed(
                  2
                )}Mb/s`,
              },
              {
                enabled: false,
                label: `Feltöltés: ${this.nettest.basicResults.uploadSpeedInMbps.toFixed(
                  2
                )}Mb/s`,
              },
              {
                enabled: false,
                label: `Ping: ${this.nettest.basicResults.pingInMs.toFixed(
                  2
                )}ms`,
              },

              ...(this.nettest.nextMeasurement
                ? [
                    { type: 'separator' as const },
                    {
                      enabled: false,
                      label: `Következő mérés: ${Nettest.parseDate(
                        this.nettest.nextMeasurement
                      )}`,
                    },
                  ]
                : []),
            ]
          : []),
      ],
    })

    ////////////////////////////////////////////////////
    const contextMenu = Menu.buildFromTemplate([
      printersMenuItem,
      usersMenuItem,
      nettest,
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
    console.time('dialog')
    const envPath = dialog.showOpenDialogSync({
      buttonLabel: 'Betölt',
      message: 'Cégkód betöltése',
      title: 'Cégkód betöltése',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: this.dev ? path.resolve(__dirname, '../../') : undefined,
    })!
    console.timeEnd('dialog')

    if (envPath.length === 0) return

    await fs.unlink(Settings.settingsPath).catch((x) => {})
    const env = await Settings.loadEnvFile(this, envPath[0])
    if (!env) return
    await this.settings.getApiKey(env)
    this.showPasscodeDialog = await this.settings.get()
    this.make()
  }
}
