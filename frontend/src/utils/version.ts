export const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";
export const BUILD_DATE = typeof __BUILD_DATE__ !== "undefined" ? __BUILD_DATE__ : new Date().toISOString().split("T")[0];
export const BUILD_HASH = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "";
export const IS_CLOUDFLARE = typeof __IS_CLOUDFLARE__ !== "undefined" ? __IS_CLOUDFLARE__ : false;

export const DISPLAY_VERSION = BUILD_HASH
  ? `v${APP_VERSION} (#${BUILD_HASH})`
  : `v${APP_VERSION}`;
