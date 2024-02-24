import isDev from "electron-is-dev";

type Object = { [key: string]: any };

export const baseUrl = isDev
  ? "https://localhost:5555"
  : "https://2.monoblokk.eu";

export const baseFetch = async (
  pathname: string,
  body: { [key: string]: any }
) => {
  const url = baseUrl + pathname;
  let result: Object;
  try {
    result = await fetch(url, {
      method: "post",
      body: JSON.stringify(body),
    }).then((x) => x.json() as Object);
  } catch (error) {
    console.error(error);
    result = { error: "fetch" };
  }
  return result;
};

export const baseRedirectUrl = (pathname: string, apiKey: string) => {
  return `${baseUrl}${pathname}?apiKey=${apiKey}`;
};
