// Loads the wasm-bindgen build of packages/guilloche-c2pa-sign. This raw-import
// + WebAssembly.Instance pattern only works in a Worker Wrangler bundles itself
// (no Vite in the path) — confirmed working here via `wrangler dev`; SvelteKit's
// Vite/adapter-cloudflare SSR pipeline has no wasm-bindgen support at all (see
// memory: c2pa_png_signing_research.md). Regenerate this directory's .wasm/.js
// files with `pnpm run build:wasm:sign` from the repo root after changing
// packages/guilloche-c2pa-sign/src — do not hand-edit them.
import wasmModule from './guilloche_c2pa_sign_bg.wasm';
// @ts-expect-error -- no .d.ts for the wasm-bindgen glue JS
import * as imports from './guilloche_c2pa_sign_bg.js';

const instance = new WebAssembly.Instance(wasmModule, {
  './guilloche_c2pa_sign_bg.js': imports,
});
imports.__wbg_set_wasm(instance.exports);
(instance.exports.__wbindgen_start as () => void)();

export const sign_png: (
  png: Uint8Array,
  generator: string,
  generatorVersion: string,
  format: string,
  instanceId: string,
  secretKeyHex: string,
  certDer: Uint8Array
) => Uint8Array = imports.sign_png;
