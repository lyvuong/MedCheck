import type { LiveFormularyProvider } from "./types.js";
import { WenoFormularyProvider } from "./weno/wenoProvider.js";

/**
 * All live (real-time API) providers the coverage-check endpoint can fall
 * back on when no pre-loaded FormularyEntry exists. Add new adapters here
 * (e.g. a future Surescripts/DrFirst integration if you get an enterprise
 * contract) — they just need to implement LiveFormularyProvider.
 */
const registeredProviders: LiveFormularyProvider[] = [new WenoFormularyProvider()];

export function getEnabledLiveProviders(): LiveFormularyProvider[] {
  return registeredProviders.filter((p) => p.enabled);
}
