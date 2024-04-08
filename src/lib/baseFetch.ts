import type { Request } from 'express'
import { TrayMenu } from './trayMenu'

type Object = { [key: string]: any }

export const baseUrl = (dev: boolean) =>
  dev ? 'https://localhost:5555' : 'https://2.monoblokk.eu'

export const baseFetch = async (
  deviceId: string,
  pathname: string,
  body: { [key: string]: any },
  trayMenu: TrayMenu
) => {
  const url = baseUrl(trayMenu.dev) + pathname
  let result: Object

  result = await fetch(url, {
    method: 'post',
    body: JSON.stringify({
      ...body,
      deviceId,
    }),
    headers: {
      'Monoblokk-Api-Key':
        trayMenu.apiKey ?? process.env.APIKEY_EXTERNAL_ACQUIRE_CLIENT_KEY,
    },
  }).then((x) => x.json() as Object)
  result = { ok: true, ...result.details }

  return result
}

export const baseRedirectUrl = (
  pathname: string,
  body: { [key: string]: any },
  dev: boolean
) => {
  const sp = new URLSearchParams(Object.entries(body))
  return `${baseUrl(dev)}${pathname}?${sp.toString()}`
}
