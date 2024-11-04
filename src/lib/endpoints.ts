import { app } from 'electron'
import { getLocationName } from './getLocationName'
import { setShiftState } from './setShiftState'
import { welcome } from './welcome'
import type { Express } from 'express'

export const endpoint = {
  welcome,
  alive: async (express: Express) => {
    express.get('/alive', async function (req, res) {
      res.json({ ok: true, version: app.getVersion() })
    })
  },
  setShiftPresent: setShiftState('Present'),
  setShiftLeft: setShiftState('Left'),
  getLocationName: getLocationName,
}
