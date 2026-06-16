import type { Express } from 'express'
import type { TrayMenu } from './trayMenu'
import { baseFetch, baseUrl } from './baseFetch'

export class POS {
  static initEndpoint = async (express: Express, trayMenu: TrayMenu) => {
    express.get('/pos', async function (req, res) {
      const apiKey = await baseFetch(
        trayMenu.ip.mac,
        '/api/external/local-client/get-pos-api-key',
        {
          locationName: trayMenu.locationName,
          passcode: trayMenu.passode,
        },
        trayMenu,
      )

      res.cookie('apiKey', apiKey.details.value, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/pos',
      })
      res.redirect(`${baseUrl(trayMenu.dev)}/pos/${trayMenu.locationName}`)
    })
  }
}
