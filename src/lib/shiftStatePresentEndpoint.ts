import type { Express } from "express";
import { baseFetch, baseRedirectUrl } from "./baseFetch";

export const shiftStatePresentEndpoint = (
  express: Express,
  makeContextMenu: (users: []) => void
) => {
  express.get("/present", async function (req, res) {
    const result = await baseFetch("/api/local/schedule/present", {});
    makeContextMenu(result.users ?? []);
    res.redirect(baseRedirectUrl("/schedule/left", result.apiKey));
  });
};
