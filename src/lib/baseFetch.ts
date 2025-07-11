import { TrayMenu } from './trayMenu'

export type Object = { [key: string]: any }

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

  let result: Record<any, any> & { ok: boolean } = { ok: false }

  const makeFetch = async () => {
    result = {
      ...result,
      ...(await fetch(url, {
        method: 'post',
        body: JSON.stringify({
          ...body,
          deviceId,
        }),
        headers: {
          'Monoblokk-Api-Key': apiKey,
        },
      })
        .then((x) => {
          return x.json() as Object
        })
        .catch((e) => {
          console.error('error with response:', e)
          throw e
        })),
    }
  }

  for (let i = 0; i < 1200; i++) {
    try {
      await makeFetch()
      break
    } catch (error) {
      console.error(
        'baseFetch errored. trying again...',
        `(${i} retries so far)`
      )
      await new Promise((res) => setTimeout(() => res(''), 500))
      result.ok = false
    }
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
