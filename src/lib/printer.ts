import {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine,
} from 'node-thermal-printer'
import * as driver from '@thiagoelg/node-printer'
import fs from 'fs/promises'
import { PrinterDetails } from '@thiagoelg/node-printer'
import { TrayMenu } from './trayMenu'

type Type = 'a4' | 'thermal' | 'sticker'

export class Printer {
  type: Type = 'a4'
  name: string
  status: string
  current = false

  trayMenu: TrayMenu

  set setCurrent(x: boolean) {
    this.current = x
    this.trayMenu.make()
  }

  set setType(x: Type) {
    this.type = x
    this.trayMenu.make()
  }

  constructor(name: string, status: string, trayMenu: TrayMenu) {
    this.name = name
    this.status = status
    this.trayMenu = trayMenu
  }

  static getPrinters = (trayMenu: TrayMenu) => {
    const printers = driver.getPrinters() as (PrinterDetails & {
      status: string
    })[]
    return printers.map((x) => new Printer(x.name, x.status, trayMenu))
  }

  test = async () => {
    const pdfBuffer = await fs.readFile('./print_test.pdf')

    try {
      driver.printDirect({
        printer: this.name,
        data: pdfBuffer,
        type: 'PDF',
        error: () => {},
        success: () => {},
      })
    } catch (error) {
      console.log(error)
    }
  }
}
