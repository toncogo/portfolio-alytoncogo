const API = "https://api.github.com";
export interface GithubCommit {
  sha: string;
  message: string;
  url: string;
  date: string;
  author: string;
}

export interface PortfolioProject {
  title: string;
  summary: string;
  impact: string;
  repositoryUrl: string;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string | null;
  pushedAt: string | null;
  technologies: string[];
  featured: boolean;
  commits: GithubCommit[];
}

interface GithubRepository {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  pushed_at: string | null;
  fork: boolean;
  archived: boolean;
}

interface SanityProject {
  title?: string;
  repositoryUrl?: string;
  summary?: string;
  impact?: string;
  techStack?: string[];
  featured?: boolean;
  sortOrder?: number;
}

function headers(): HeadersInit {
  const result: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  // This value is read during the build only. Never expose it through a PUBLIC_ variable.
  if (import.meta.env.GITHUB_TOKEN) {
    result.Authorization = `Bearer ${import.meta.env.GITHUB_TOKEN}`;
  }

  return result;
}

async function githubFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function parseRepositoryUrl(value: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com") return null;

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2) return null;
    return { owner: segments[0], repo: segments[1].replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

async function getRepository(
  owner: string,
  repo: string,
): Promise<GithubRepository | null> {
  return githubFetch<GithubRepository>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
}

async function getRecentCommits(
  owner: string,
  repo: string,
): Promise<GithubCommit[]> {
  const commits = await githubFetch<
    Array<{
      sha: string;
      html_url: string;
      commit?: {
        message?: string;
        author?: { name?: string; date?: string };
      };
      author?: { login?: string } | null;
    }>
  >(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=3`,
  );

  return (commits ?? []).map((entry) => ({
    sha: entry.sha,
    message: (entry.commit?.message ?? "Change without a message").split("\n")[0],
    url: entry.html_url,
    date: entry.commit?.author?.date ?? "",
    author: entry.author?.login ?? entry.commit?.author?.name ?? "Contributor",
  }));
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        output[index] = await mapper(values[index]);
      }
    }),
  );

  return output;
}

function fromRepository(
  repo: GithubRepository,
  custom?: SanityProject,
): PortfolioProject {
  return {
    title: custom?.title?.trim() || repo.name,
    summary: custom?.summary?.trim() || repo.description || "Public repository on GitHub.",
    impact: custom?.impact?.trim() || "",
    repositoryUrl: repo.html_url,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    technologies: (custom?.techStack ?? []).filter((item) => typeof item === "string"),
    featured: Boolean(custom?.featured),
    commits: [],
  };
}

export async function getGithubProjects(
  username = import.meta.env.PUBLIC_GITHUB_USERNAME || "toncogo",
  curatedProjects: SanityProject[] = [],
  maxProjects = 24,
): Promise<PortfolioProject[]> {
  const repos = await githubFetch<GithubRepository[]>(
    `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=100`,
  );

  const publicRepos = (repos ?? [])
    .filter((repo) => !repo.fork && !repo.archived)
    .sort(
      (a, b) =>
        b.stargazers_count - a.stargazers_count ||
        Date.parse(b.pushed_at ?? b.updated_at) -
          Date.parse(a.pushed_at ?? a.updated_at),
    );
  const reposByUrl = new Map(
    publicRepos.map((repo) => [repo.html_url.replace(/\/$/, "").toLowerCase(), repo]),
  );

  const chosen: Array<{
    repo: GithubRepository;
    custom?: SanityProject;
  }> = [];

  for (const custom of curatedProjects) {
    const parsed = custom.repositoryUrl
      ? parseRepositoryUrl(custom.repositoryUrl)
      : null;
    if (!parsed) continue;

    const match = reposByUrl.get(
      `https://github.com/${parsed.owner}/${parsed.repo}`.toLowerCase(),
    );
    const repo = match ?? (await getRepository(parsed.owner, parsed.repo));
    if (repo) chosen.push({ repo, custom });
  }

  if (!curatedProjects.length) {
    for (const repo of publicRepos.slice(0, maxProjects)) chosen.push({ repo });
  }

  const projects = await mapWithConcurrency(chosen, 6, async ({ repo, custom }) => ({
    ...fromRepository(repo, custom),
    commits: await getRecentCommits(
      repo.full_name.split("/")[0],
      repo.full_name.split("/")[1],
    ),
  }));

  if (curatedProjects.length) {
    const customOrder = new Map(
      curatedProjects.map((item, index) => [item.repositoryUrl?.toLowerCase(), index]),
    );
    projects.sort((a, b) => {
      const aIndex = customOrder.get(a.repositoryUrl.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = customOrder.get(b.repositoryUrl.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }

  return projects.slice(0, maxProjects);
}
