import { Menu, MenuItem, Tray, app, nativeImage } from 'electron'
import { Printer } from './printer'
type Users = { ip: string; name: string }[]

export class TrayMenu {
  private printers: Printer[]
  private users: Users
  private refreshPrinterInterval = 5000

  public set setPrinters(p: Printer[]) {
    this.printers = p
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

  tray: Tray
  currentPrinterName: string

  constructor() {
    this.printers = Printer.getPrinters(this)
    this.users = []
  }

  init = () => {
    this.tray = new Tray(nativeImage.createFromPath('./M.png'))
    this.tray.setToolTip('Monoblokk kliens')
  }

  make = () => {
    const printersMenuItem = new MenuItem({
      type: 'submenu',
      label: 'Nyomtatók',
      submenu: [
        ...this.printers.map((x) => ({
          label: x.name,
          enabled: x.status !== 'IDLE',
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
                        checked: x.type === 'a4',
                        click: () => (x.setType = 'a4'),
                      },
                      {
                        label: 'Blokk',
                        type: 'radio' as const,
                        checked: x.type === 'thermal',
                        click: () => (x.setType = 'thermal'),
                      },
                      {
                        label: 'Címke',
                        type: 'radio' as const,
                        checked: x.type === 'sticker',
                        click: () => (x.setType = 'sticker'),
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
    const quit = new MenuItem({ label: 'Kilépés', click: () => app.quit() })

    const contextMenu = Menu.buildFromTemplate([
      printersMenuItem,
      usersMenuItem,
      { type: 'separator' },
      quit,
    ])
    this.tray.setContextMenu(contextMenu)
  }

  refreshPrinters = () => {
    this.setPrinters = [new Printer('Frissítés...', 'refreshing', this)]
    setTimeout(
      () => (this.setPrinters = Printer.getPrinters(this)),
      this.refreshPrinterInterval
    )
  }
}
