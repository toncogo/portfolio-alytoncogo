import { createClient } from "@sanity/client";
import { DEFAULT_SETTINGS } from "@data/defaults";
import { getGithubProjects } from "@lib/github";
import type { PortfolioProject } from "@lib/github";

export interface SiteSettings {
  pageTitle: string;
  headline: string;
  heroDescription: string;
  aboutIntro: string;
  accentColor: string;
  profileImageUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
  facebookUrl: string;
  discordUrl: string;
}

const emptySettings: SiteSettings = { ...DEFAULT_SETTINGS };
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID?.trim();
const dataset = import.meta.env.PUBLIC_SANITY_DATASET?.trim() || "production";
const sanityConfigured = Boolean(projectId && /^[a-z0-9-]+$/i.test(projectId));

const sanityClient = sanityConfigured
  ? createClient({
      projectId: projectId!,
      dataset,
      apiVersion: "2026-03-01",
      useCdn: false,
    })
  : null;

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function safeHttpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function cleanSettings(remote: Partial<SiteSettings> | null | undefined): SiteSettings {
  return {
    pageTitle:
      typeof remote?.pageTitle === "string" && remote.pageTitle.trim()
        ? remote.pageTitle.trim()
        : emptySettings.pageTitle,
    headline:
      typeof remote?.headline === "string" && remote.headline.trim()
        ? remote.headline.trim()
        : emptySettings.headline,
    heroDescription:
      typeof remote?.heroDescription === "string" && remote.heroDescription.trim()
        ? remote.heroDescription.trim()
        : emptySettings.heroDescription,
    aboutIntro:
      typeof remote?.aboutIntro === "string" && remote.aboutIntro.trim()
        ? remote.aboutIntro.trim()
        : emptySettings.aboutIntro,
    accentColor: isHexColor(remote?.accentColor)
      ? remote.accentColor
      : emptySettings.accentColor,
    profileImageUrl: safeHttpsUrl(remote?.profileImageUrl) || emptySettings.profileImageUrl,
    instagramUrl: safeHttpsUrl(remote?.instagramUrl),
    whatsappUrl: safeHttpsUrl(remote?.whatsappUrl),
    facebookUrl: safeHttpsUrl(remote?.facebookUrl),
    discordUrl: safeHttpsUrl(remote?.discordUrl),
  };
}

interface SiteSnapshot {
  settings: SiteSettings;
  projects: PortfolioProject[];
}

let siteSnapshotPromise: Promise<SiteSnapshot> | null = null;

export function getSiteSnapshot(): Promise<SiteSnapshot> {
  siteSnapshotPromise ??= buildSiteSnapshot();
  return siteSnapshotPromise;
}

async function buildSiteSnapshot(): Promise<SiteSnapshot> {
  let settings = emptySettings;
  let curatedProjects: Array<{
    title?: string;
    repositoryUrl?: string;
    summary?: string;
    impact?: string;
    techStack?: string[];
    featured?: boolean;
    sortOrder?: number;
  }> = [];

  if (sanityClient) {
    try {
      const [remoteSettings, remoteProjects] = await Promise.all([
        sanityClient.fetch<Partial<SiteSettings> | null>(
          '*[_type == "siteSettings"] | order(_updatedAt desc)[0]{pageTitle,headline,heroDescription,aboutIntro,accentColor,profileImageUrl,instagramUrl,whatsappUrl,facebookUrl,discordUrl}',
        ),
        sanityClient.fetch<typeof curatedProjects>(
          '*[_type == "project"] | order(featured desc, sortOrder asc, title asc){title,repositoryUrl,summary,impact,techStack,featured,sortOrder}',
        ),
      ]);
      settings = cleanSettings(remoteSettings);
      curatedProjects = remoteProjects ?? [];
    } catch (error) {
      console.warn(
        "Sanity unavailable during generation; using public GitHub data and default values.",
        error instanceof Error ? error.message : "Unknow error",
      );
    }
  }

  const username = import.meta.env.PUBLIC_GITHUB_USERNAME || "toncogo";
  const projects = await getGithubProjects(
    username,
    curatedProjects,
    curatedProjects.length || 24,
  );

  return {
    settings,
    projects,
  };
}
