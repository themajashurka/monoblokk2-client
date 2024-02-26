import type { Express } from 'express'
import { baseFetch, baseRedirectUrl } from './baseFetch'
import { TrayMenu } from './trayMenu'

export const shiftStateLeft = (
  express: Express,
  trayMenu: TrayMenu,
  isDev: boolean
) => {
  express.get('/left', async function (req, res) {
    const result = await baseFetch(
      req,
      '/api/external/schedule/left',
      {},
      isDev
    )
    trayMenu.setUsers = [...trayMenu.getUsers, result.users]
    res.redirect(
      baseRedirectUrl(
        '/schedule/left',
        { apiKey: result.apiKey, shiftId: result.shiftId },
        isDev
      )
    )
  })
}
