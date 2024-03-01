import type { Express } from 'express'
import { baseFetch, baseRedirectUrl } from './baseFetch'
import { TrayMenu } from './trayMenu'

export const setShiftState =
  (state: 'Present' | 'Left') => (express: Express, trayMenu: TrayMenu) => {
    express.get('/shift/' + state, async function (req, res) {
      const deviceId = new URL('http://localhost/' + req.url).searchParams.get(
        'deviceId'
      )!

      const result = await baseFetch(
        deviceId,
        '/api/external/local-client/schedule/' + state.toLowerCase(),
        {},
        trayMenu
      )
      console.log('result', result)
      if (result.ok) {
        //trayMenu.setUsers = [...trayMenu.getUsers, result.users]
        res.redirect(
          baseRedirectUrl(
            '/schedule/' + state.toLocaleLowerCase(),
            {
              apiKey: trayMenu.apiKey,
              shiftId: result.shiftId,
              confirmed: true,
            },
            trayMenu.dev
          )
        )
      } else {
        res.send('kaki')
      }
    })
  }
