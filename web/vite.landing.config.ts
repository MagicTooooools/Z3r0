import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function landingIndexHtml(): Plugin {
  return {
    name: "z3r0-landing-index-html",
    enforce: "post",
    generateBundle(_, bundle) {
      const html = bundle["landing.html"];
      if (!html || html.type !== "asset") return;
      html.fileName = "index.html";
      bundle["index.html"] = html;
      delete bundle["landing.html"];
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), landingIndexHtml()],
  build: {
    outDir: "dist-landing",
    emptyOutDir: true,
    rollupOptions: {
      input: "landing.html",
    },
  },
});
