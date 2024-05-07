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
import path from 'path'

export type PrinterType = 'A4' | 'Thermal' | 'Sticker'
export type PrinterObj = Pick<Printer, 'name' | 'type' | 'current'>

export class Printer {
  type: PrinterType = 'A4'
  name: string
  status: string
  current = false

  trayMenu: TrayMenu

  set setCurrent(x: boolean) {
    this.current = x
    this.trayMenu.make()
    this.trayMenu.settings.save({
      printers: [{ name: this.name, type: this.type, current: true }],
    })
  }

  set setType(x: PrinterType) {
    this.type = x
    this.trayMenu.make()
    this.trayMenu.settings.save({
      printers: [{ name: this.name, type: x, current: this.current }],
    })
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
    switch (this.type) {
      case 'A4':
        const pdfBuffer = await fs.readFile(
          this.trayMenu.dev
            ? './print_test.pdf'
            : path.join(process.resourcesPath, 'print_test.pdf')
        )

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

        break

      case 'Thermal':
        const printer = new ThermalPrinter({
          type: PrinterTypes.EPSON, // 'star' or 'epson'
          interface: 'printer:' + this.name,
          options: {
            timeout: 1000,
          },
          driver,
          width: 100, // Number of characters in one line - default: 48
          characterSet: CharacterSet.SLOVENIA, // Character set - default: SLOVENIA
          breakLine: BreakLine.WORD, // Break line after WORD or CHARACTERS. Disabled with NONE - default: WORD
          removeSpecialCharacters: false, // Removes special characters - default: false
          lineCharacter: '-', // Use custom character for drawing lines - default: -
        })

        await printer.isPrinterConnected()

        printer.alignRight()
        printer.println('Jobbra')
        printer.alignCenter()
        printer.println('Középre')
        printer.alignLeft()
        printer.println('Balra')
        printer.setTextQuadArea()
        printer.println('Nagy')
        printer.setTextNormal()
        printer.beep(3, 3)
        printer.alignCenter()
        printer.printBarcode('abcd1234ab', 73, {
          height: 80,
          hriFont: 0,
          hriPos: 2,
          width: 3,
        })
        // "SMALL", "MEDIUM", "LARGE",
        // 50 < x < 80
        // 1 - No text
        // 2 - Text on bottom
        // 3 - No text inline
        // 4 - Text on bottom inline
        printer.alignLeft()
        printer.cut()
        printer.println('Vágás')
        printer.cut()
        await printer.execute()
        break
    }
  }
}
