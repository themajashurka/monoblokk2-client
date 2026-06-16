import { TrayMenu } from './trayMenu'
import { SerialPort } from 'serialport'
import type { Express } from 'express'
import fs from 'fs'

export type CashRegisterSettings = {
  manufacturer: 'Datecs' | 'Fiscat' | undefined
  baudRate: number
}

export class CashRegister {
  private trayMenu: TrayMenu
  port!: SerialPort<any>
  settings!: CashRegisterSettings

  constructor(trayMenu: TrayMenu) {
    this.trayMenu = trayMenu
  }

  private static detectUsbDevicePath = (): string => {
    const devices = fs
      .readdirSync('/dev/')
      .filter((entry) => entry.startsWith('ttyUSB'))
    if (devices.length === 0) {
      throw new Error('No USB serial device detected')
    }
    return `/dev/${devices[0]}`
  }

  setSettings = (settings: CashRegisterSettings) => {
    this.settings = settings
    this.port = new SerialPort({
      path: CashRegister.detectUsbDevicePath(),
      baudRate: settings.baudRate,
    })
  }

  static open = (express: Express, trayMenu: TrayMenu) => {
    express.post('/open', async (req, res) => {
      const cashRegister = trayMenu.cashRegister
      const args = req.body.args as {
        drawerCashAmount: number
      }

      switch (cashRegister.settings!.manufacturer) {
        case 'Datecs':
          const message = `datecs.hu||||OP|LOCA||${args.drawerCashAmount}\n`

          cashRegister.port.write(message)
          break

        default:
          break
      }

      res.json({ ok: true })
    })
  }

  static close = (express: Express, trayMenu: TrayMenu) => {
    express.post('/close', async (req, res) => {
      const cashRegister = trayMenu.cashRegister

      switch (cashRegister.settings!.manufacturer) {
        case 'Datecs':
          const message = 'datecs.hu||||DC|1|0|1|1\n'

          cashRegister.port.write(message)
          break

        default:
          break
      }

      res.json({ ok: true })
    })
  }

  static sell = (express: Express, trayMenu: TrayMenu) => {
    express.post('/sell', async (req, res) => {
      const cashRegister = trayMenu.cashRegister
      const args = req.body.args as {
        footer: string
        purchaseReference: string
        payments: { amount: number; method: 'card' | 'cash' | 'voucher' }[]
        purchaseDetails: {
          brandName: string
          presentationalModel: string
          price: number
          discount: number
        }[]
      }

      switch (cashRegister.settings!.manufacturer) {
        case 'Datecs':
          const message = `datecs.hu||||SLD||biz|${
            args.footer.split('\n').length + 1
          }|${args.footer.replaceAll('\n', '|')}|${args.purchaseReference}||||${
            args.purchaseDetails.length
          }|${args.purchaseDetails
            .map((pd) =>
              [
                `${pd.brandName} ${pd.presentationalModel}`,
                3,
                pd.price,
                1,
                pd.discount > 0 ? `M${(pd.discount * 100).toFixed(2)}` : '',
              ].join('|'),
            )
            .join('|')}|${args.payments
            .filter((p) => p.amount > 0)
            .map((p) => `${p.method === 'card' ? 'N' : 'P'}|${p.amount}`)
            .join('|')}\n`

          console.log(message)

          cashRegister.port.write(message)
          break

        default:
          break
      }

      res.json({ ok: true })
    })
  }

  static storno = (express: Express, trayMenu: TrayMenu) => {
    express.post('/storno', async (req, res) => {
      const cashRegister = trayMenu.cashRegister
      const args = req.body.args as {
        dayIndex: number
        sequence: number
      }

      switch (cashRegister.settings!.manufacturer) {
        case 'Datecs':
          const message = `datecs.hu||||STORNO|${args.dayIndex}|${args.sequence}|1|||||||||||||\n`

          cashRegister.port.write(message)
          break

        default:
          break
      }

      res.json({ ok: true })
    })
  }
}
