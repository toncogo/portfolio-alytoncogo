interface ApiRepository {
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

interface ApiCommit {
  sha: string;
  html_url: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
  };
  author?: { login?: string } | null;
}

interface ProjectCommit {
  sha: string;
  message: string;
  url: string;
  date: string;
  author: string;
}

interface LiveProject {
  title: string;
  repositoryUrl: string;
  summary: string;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  commits: ProjectCommit[];
}

interface CachedProjects {
  timestamp: number;
  projects: LiveProject[];
}

const API = "https://api.github.com";
const CACHE_TTL = 20 * 60 * 1000;
const grid = document.querySelector<HTMLElement>("[data-project-grid]");
const statusElement = document.querySelector<HTMLElement>("[data-project-status]");

function safeGithubUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isProjectCommit(value: unknown): value is ProjectCommit {
  if (!value || typeof value !== "object") return false;
  const commit = value as Partial<ProjectCommit>;
  return (
    typeof commit.sha === "string" &&
    typeof commit.message === "string" &&
    safeGithubUrl(commit.url) !== null &&
    typeof commit.date === "string" &&
    typeof commit.author === "string"
  );
}

function isLiveProject(value: unknown): value is LiveProject {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<LiveProject>;
  return (
    typeof project.title === "string" &&
    safeGithubUrl(project.repositoryUrl) !== null &&
    typeof project.summary === "string" &&
    (typeof project.language === "string" || project.language === null) &&
    typeof project.updatedAt === "string" &&
    typeof project.stars === "number" &&
    Number.isFinite(project.stars) &&
    typeof project.forks === "number" &&
    Number.isFinite(project.forks) &&
    Array.isArray(project.commits) &&
    project.commits.every(isProjectCommit)
  );
}

function readCache(key: string): LiveProject[] | null {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return null;
    const cached = JSON.parse(value) as Partial<CachedProjects>;
    if (
      typeof cached.timestamp !== "number" ||
      Date.now() - cached.timestamp > CACHE_TTL ||
      !Array.isArray(cached.projects)
    ) return null;
    return cached.projects.filter(isLiveProject);
  } catch {
    return null;
  }
}

function writeCache(key: string, projects: LiveProject[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), projects }));
  } catch {
    // The page works without session storage.
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}.`);
  return (await response.json()) as T;
}

async function getCommits(repository: ApiRepository): Promise<ProjectCommit[]> {
  const [owner, name] = repository.full_name.split("/");
  if (!owner || !name) return [];

  try {
    const entries = await fetchJson<ApiCommit[]>(
      `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits?per_page=3`,
    );
    return entries.map((entry) => ({
      sha: entry.sha,
      message: (entry.commit?.message ?? "Change without a message").split("\n")[0],
      url: entry.html_url,
      date: entry.commit?.author?.date ?? "",
      author: entry.author?.login ?? entry.commit?.author?.name ?? "Contributor",
    }));
  } catch {
    return [];
  }
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

function textElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  value: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
}

function externalLink(label: string, value: string, className = ""): HTMLAnchorElement | null {
  const href = safeGithubUrl(value);
  if (!href) return null;
  const link = textElement("a", className, label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function formatDate(value: string | null): string {
  if (!value) return "Data indisponível";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data unavailable";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Campo_Grande",
  }).format(date);
}

function renderCommit(commit: ProjectCommit): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "commit-item";
  item.append(textElement("span", "commit-sha", commit.sha.slice(0, 7)));

  const metadata = document.createElement("div");
  metadata.className = "commit-meta";
  const link = externalLink(commit.message, commit.url);
  if (link) {
    link.title = commit.message;
    metadata.append(link);
  } else {
    metadata.append(textElement("span", "commit-message", commit.message));
  }
  metadata.append(textElement("span", "", `${commit.author} · ${formatDate(commit.date)}`));
  item.append(metadata);
  return item;
}

function renderProject(project: LiveProject): HTMLElement {
  const card = document.createElement("article");
  card.className = "project-card";
  card.dataset.repository = project.repositoryUrl;

  const top = document.createElement("div");
  top.className = "project-card-top";
  top.append(textElement("span", "project-repo-icon", "⌘"));
  top.append(textElement("span", "", project.language ?? "Open source"));
  card.append(top);

  const heading = document.createElement("h3");
  const titleLink = externalLink(project.title, project.repositoryUrl);
  if (titleLink) heading.append(titleLink);
  card.append(heading);
  card.append(textElement("p", "project-description", project.summary));

  const facts = document.createElement("div");
  facts.className = "repo-facts";
  facts.append(textElement("span", "", `★ ${new Intl.NumberFormat("pt-BR").format(project.stars)}`));
  facts.append(textElement("span", "", `⑂ ${new Intl.NumberFormat("pt-BR").format(project.forks)}`));
  card.append(facts);

  if (project.commits.length) {
    const commits = document.createElement("ul");
    commits.className = "commit-list";
    commits.setAttribute("aria-label", `Latest changes to ${project.title}`);
    for (const commit of project.commits) commits.append(renderCommit(commit));
    card.append(commits);
  }

  const bottom = document.createElement("div");
  bottom.className = "project-card-bottom";
  const repositoryLink = externalLink("Open repository ↗", project.repositoryUrl);
  if (repositoryLink) bottom.append(repositoryLink);
  const updated = document.createElement("span");
  updated.className = "project-updated";
  updated.append(document.createTextNode("Updated"), document.createElement("br"));
  updated.append(document.createTextNode(formatDate(project.updatedAt)));
  bottom.append(updated);
  card.append(bottom);
  return card;
}

function showStatus(message: string, username: string, retry: () => void): void {
  if (!statusElement) return;
  statusElement.replaceChildren(document.createTextNode(`${message} `));
  const profile = document.createElement("a");
  profile.href = `https://github.com/${encodeURIComponent(username)}`;
  profile.target = "_blank";
  profile.rel = "noopener noreferrer";
  profile.textContent = "Open GitHub profile";
  statusElement.append(profile);
  if (message.includes("failed")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "project-retry";
    button.textContent = "Try again";
    button.addEventListener("click", retry, { once: true });
    statusElement.append(document.createTextNode(" · "), button);
  }
  statusElement.hidden = false;
}

async function loadProjects(username: string, limit: number, cacheKey: string): Promise<void> {
  if (!grid || grid.querySelector(".project-card")) return;
  if (statusElement) {
    statusElement.hidden = false;
    statusElement.textContent = "Searching for public repositories on GitHub…";
  }

  const cached = readCache(cacheKey);
  if (cached?.length) {
    grid.replaceChildren(...cached.slice(0, limit).map(renderProject));
    if (statusElement) statusElement.hidden = true;
    return;
  }

  try {
    const repositories = await fetchJson<ApiRepository[]>(
      `${API}/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=100`,
    );
    const selected = repositories
      .filter((repo) => !repo.fork && !repo.archived && safeGithubUrl(repo.html_url))
      .sort(
        (a, b) =>
          b.stargazers_count - a.stargazers_count ||
          Date.parse(b.pushed_at ?? b.updated_at) - Date.parse(a.pushed_at ?? a.updated_at),
      )
      .slice(0, limit);

    const projects = await mapWithConcurrency(selected, 4, async (repo) => ({
      title: repo.name,
      repositoryUrl: repo.html_url,
      summary: repo.description?.trim() || "Public repository on GitHub.",
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.pushed_at ?? repo.updated_at,
      commits: await getCommits(repo),
    }));

    if (!projects.length) throw new Error("No public repository was found.");
    writeCache(cacheKey, projects);
    grid.replaceChildren(...projects.map(renderProject));
    if (statusElement) statusElement.hidden = true;
  } catch {
    showStatus(
      "Loading the projects failed. Check your connection and try again.",
      username,
      () => void loadProjects(username, limit, cacheKey),
    );
  }
}

if (grid && !grid.querySelector(".project-card")) {
  const username = grid.dataset.githubUser || "toncogo";
  const parsedLimit = Number(grid.dataset.limit);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 24;
  const cacheKey = `portfolio-projects:${username}:${limit}`;
  void loadProjects(username, limit, cacheKey);
}
