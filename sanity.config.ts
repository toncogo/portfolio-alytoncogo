import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { projectSchema } from "./sanity/schemaTypes/project";
import { siteSettingsSchema } from "./sanity/schemaTypes/siteSettings";

const projectId = process.env.SANITY_STUDIO_PROJECT_ID?.trim();

if (!projectId) {
  throw new Error(
    "Define SANITY_STUDIO_PROJECT_ID in the .env before starting Sanity Studio.",
  );
}

export default defineConfig({
  name: "portfolio",
  title: "Portfolio · Alyton Cogo",
  projectId,
  dataset: process.env.SANITY_STUDIO_DATASET?.trim() || "production",
  plugins: [structureTool()],
  schema: {
    types: [siteSettingsSchema, projectSchema],
  },
});
