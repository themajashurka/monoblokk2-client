import {
  ThermalPrinter,
  PrinterTypes,
  CharacterSet,
  BreakLine,
} from "node-thermal-printer";
import * as driver from "@thiagoelg/node-printer";

export const gt = () => driver.getPrinters();
