import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import replace from "@rollup/plugin-replace";
import { defineConfig, loadEnv } from "vite";

const pagesDir = resolve(__dirname, "web/pages");
const pages = Object.fromEntries(
  readdirSync(pagesDir).map((page) => [page.replace(".html", ""), `web/pages/${page}`]),
);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    root: "web",
    // inline postcss config stops vite walking up past the repo for one
    css: { postcss: {} },
    build: {
      target: "esnext",
      outDir: "../dist/web",
      assetsDir: "_",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: { input: pages },
    },
    plugins: [
      replace({
        preventAssignment: true,
        include: ["**/*.html"],
        values: {
          PLAUSIBLE_SCRIPT: env.PUB_PLAUSIBLE_URL
            ? `<script defer data-domain="${env.PUB_HOSTNAME ?? "fixspotify.com"}" src="${env.PUB_PLAUSIBLE_URL}/js/script.js"></script>`
            : "",
        },
      }),
    ],
  };
});
