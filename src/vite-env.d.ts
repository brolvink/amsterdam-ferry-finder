/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_TILE_URL_DAY?: string;
  readonly VITE_TILE_URL_NIGHT?: string;
  readonly VITE_TILE_ATTRIBUTION?: string;
}
