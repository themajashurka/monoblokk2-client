import type { Request } from "express";

type Object = { [key: string]: any };

export const baseUrl = (isDev: boolean) =>
  isDev ? "https://localhost:5555" : "https://2.monoblokk.eu";

export const baseFetch = async (
  req: Request,
  pathname: string,
  body: { [key: string]: any },
  isDev: boolean
) => {
  const url = baseUrl(isDev) + pathname;
  const fd = new FormData();
  fd.set("deviceId", req.cookies.deviceId);
  for (const key in body) {
    fd.set(key, body[key]);
  }
  let result: Object;
  try {
    result = await fetch(url, {
      method: "post",
      body: fd,
      headers: {
        "Monoblokk-Api-Key": process.env.APIKEY_EXTERNAL_SCHEDULE,
      },
    }).then((x) => x.json() as Object);
  } catch (error) {
    console.error(error);
    result = { error: "fetch" };
  }
  return result;
};

export const baseRedirectUrl = (
  pathname: string,
  body: { [key: string]: any },
  isDev: boolean
) => {
  const sp = new URLSearchParams(Object.entries(body));
  return `${baseUrl(isDev)}${pathname}?${sp.toString()}`;
};
