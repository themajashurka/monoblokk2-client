import type { Express } from 'express'
import fs from 'fs/promises'
import { TrayMenu } from './trayMenu'

export const getLocationName = async (express: Express, trayMenu: TrayMenu) => {
  express.get('/getLocationName', async function (req, res) {
    res.send(trayMenu.locationName)
  })
}
