import type { Express } from "express";
import { baseFetch, baseRedirectUrl, baseUrl } from "./baseFetch";

export const shiftStateLeftEndpoint = (
  express: Express,
  makeContextMenu: (users: []) => void
) => {
  express.get("/left", async function (req, res) {
    const result = await baseFetch("/api/local/schedule/left", {});
    makeContextMenu(result.users ?? []);
    res.redirect(baseRedirectUrl("/schedule/present", result.apiKey));
  });
};
