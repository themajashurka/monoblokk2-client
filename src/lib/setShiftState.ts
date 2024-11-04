import type { Express } from 'express'
import { baseFetch, baseRedirectUrl } from './baseFetch'
import { TrayMenu } from './trayMenu'

export const setShiftState =
  (state: 'Present' | 'Left') => (express: Express, trayMenu: TrayMenu) => {
    express.get('/shift/' + state, async function (req, res) {
      const searchParams = new URL('http://localhost/' + req.url).searchParams
      const deviceId = (searchParams.get('deviceId') ??
        searchParams.get('session'))!
      const noRedirect = searchParams.get('noRedirect')

      const result = await baseFetch(
        deviceId,
        '/api/external/local-client/schedule/' + state.toLowerCase(),
        {},
        trayMenu
      )
      if (result.ok) {
        try {
          if (state === 'Present') {
            trayMenu.addUsers = result.details.users.map((u: any) => u.fullName)
          } else {
            trayMenu.deleteUser = result.details.users[0].fullName
          }
        } catch (error) {
          console.error(error)
        }

        if (noRedirect) {
          res.json(result)
        } else {
          res.redirect(
            baseRedirectUrl(
              '/schedule/' + state.toLocaleLowerCase(),
              {
                apiKey: result.apiKey,
                shiftId: result.shiftId,
                confirmed: true,
              },
              trayMenu.dev
            )
          )
        }
      } else {
        if (noRedirect) {
          res.json(result)
        } else {
          res.redirect(
            baseRedirectUrl(
              '/schedule/' + state.toLocaleLowerCase(),
              {
                confirmed: true,
                notReady: true,
              },
              trayMenu.dev
            )
          )
        }
      }
    })
  }
