import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site:
    process.env.SITE_URL ??
    "https://alyton-cogo-portfolio-ti.cogotechnologies.chatgpt.site",
  output: "static",
  vite: {
    plugins: [tailwindcss()],
  },
});
