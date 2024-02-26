import type { Express } from 'express'
import { baseFetch, baseRedirectUrl } from './baseFetch'
import { TrayMenu } from './trayMenu'

export const shiftStatePresent = (
  express: Express,
  trayMenu: TrayMenu,
  isDev: boolean
) => {
  express.get('/present', async function (req, res) {
    const result = await baseFetch(
      req,
      '/api/external/schedule/present',
      {},
      isDev
    )
    trayMenu.setUsers = [...trayMenu.getUsers, result.users]
    res.redirect(
      baseRedirectUrl(
        '/schedule/present',
        { apiKey: result.apiKey, shiftId: result.shiftId },
        isDev
      )
    )
  })
}
