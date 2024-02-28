import type { Express } from 'express'
import { baseFetch, baseRedirectUrl } from './baseFetch'
import { TrayMenu } from './trayMenu'

export const shiftStateLeft = (express: Express, trayMenu: TrayMenu) => {
  express.get('/left', async function (req, res) {
    const result = await baseFetch(
      req.cookies.deviceId,
      '/api/external/schedule/left',
      {},
      trayMenu
    )
    trayMenu.setUsers = [...trayMenu.getUsers, result.users]
    res.redirect(
      baseRedirectUrl(
        '/schedule/left',
        { apiKey: result.apiKey, shiftId: result.shiftId },
        trayMenu.dev
      )
    )
  })
}
