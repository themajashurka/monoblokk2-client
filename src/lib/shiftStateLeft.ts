import type { Express } from "express";
import { baseFetch, baseRedirectUrl } from "./baseFetch";

export const shiftStateLeft = (
  express: Express,
  makeContextMenu: (users: any[]) => void,
  users: any[],
  isDev: boolean
) => {
  express.get("/left", async function (req, res) {
    const result = await baseFetch(
      req,
      "/api/external/schedule/left",
      {},
      isDev
    );
    makeContextMenu([...users, result.users]);
    res.redirect(
      baseRedirectUrl(
        "/schedule/left",
        { apiKey: result.apiKey, shiftId: result.shiftId },
        isDev
      )
    );
  });
};
