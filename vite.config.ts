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
          CF_ANALYTICS: JSON.stringify({ token: env.CF_ANALYTICS_ID ?? "" }),
        },
      }),
    ],
  };
});
