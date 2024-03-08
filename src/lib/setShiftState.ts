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
      console.log('result', result, trayMenu.apiKey)
      if (result.ok) {
        //trayMenu.setUsers = [...trayMenu.getUsers, result.users]
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
      } else {
        res.send('kaki')
      }
    })
  }
