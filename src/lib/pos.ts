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

      res.redirect(
        `${baseUrl(trayMenu)}/pos/${trayMenu.locationName}?apiKey=${apiKey.details.value}&ip=${trayMenu.ip.ip.replaceAll('.', '-')}`,
      )
    })
  }

  static forwardHeartbeat = async (express: Express, trayMenu: TrayMenu) => {
    express.get('/pos-heartbeat', async function (req, res) {
      const result = await baseFetch(
        (await trayMenu.settings.getMacIp()).mac,
        '/api/external/local-client/pos-heartbeat',
        { version: req.query.version },
        trayMenu,
      )

      res.json({ ok: result.ok })
    })
  }
}
