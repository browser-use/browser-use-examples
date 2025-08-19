import { BrowserUse } from "browser-use-sdk";

export const browseruse = new BrowserUse({
  apiKey: process.env.BROWSER_USE_API_KEY!,
});
