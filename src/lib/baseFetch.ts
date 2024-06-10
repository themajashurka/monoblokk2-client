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
  const apiKey =
    trayMenu.apiKey ?? process.env.APIKEY_EXTERNAL_ACQUIRE_CLIENT_KEY
  const url = baseUrl(trayMenu.dev) + pathname

  let result: Object = {}
  try {
    result = await fetch(url, {
      method: 'post',
      body: JSON.stringify({
        ...body,
        deviceId,
      }),
      headers: {
        'Monoblokk-Api-Key': apiKey,
      },
    }).then((x) => x.json() as Object)
    result = { ok: result.ok, ...result.details } //TODO: str8 result, nem kell result.details
  } catch (error) {
    result.ok = false
  }

  if (!result.ok) {
    console.error(apiKey, '-> result was NOT ok for ->', pathname, result)
  } else {
    console.log(apiKey, '-> result ok at ->', pathname, result)
  }

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
