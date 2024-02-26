import type { Express } from "express";
import { baseFetch, baseRedirectUrl } from "./baseFetch";

export const shiftStatePresent = (
  express: Express,
  makeContextMenu: (users: any[]) => void,
  users: any[],
  isDev: boolean
) => {
  express.get("/present", async function (req, res) {
    const result = await baseFetch(
      req,
      "/api/external/schedule/present",
      {},
      isDev
    );
    makeContextMenu([...users, result.users]);
    res.redirect(
      baseRedirectUrl(
        "/schedule/present",
        { apiKey: result.apiKey, shiftId: result.shiftId },
        isDev
      )
    );
  });
};
