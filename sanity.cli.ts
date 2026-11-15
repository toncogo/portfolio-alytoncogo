import { defineCliConfig } from "sanity/cli";

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = process.env.PUBLIC_SANITY_DATASET?.trim() || "production";

if (!projectId) {
  throw new Error(
    "Define PUBLIC_SANITY_PROJECT_ID in the .env before starting Sanity Studio.",
  );
}

export default defineCliConfig({
  api: {
    projectId,
    dataset,
  },
});
