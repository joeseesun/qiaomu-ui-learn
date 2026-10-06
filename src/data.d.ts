// data/*.json are bundled as raw strings by esbuild (see esbuild.config.mjs).
declare module "*.json" {
  const raw: string;
  export default raw;
}
