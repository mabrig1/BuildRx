/**
 * GitHub API service layer (server-only).
 *
 * Pushes use the Git Data API (blobs → tree → commit → ref) so a whole
 * project snapshot lands as a single commit, including into empty repos.
 */

const API = "https://api.github.com";

export interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GitHubRepo {
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface PushResult {
  commitSha: string;
  commitUrl: string;
  fileCount: number;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubClient {
  constructor(private token: string) {}

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let detail = response.statusText;
      try {
        const data = await response.json();
        detail = data?.message ?? detail;
      } catch {
        // keep statusText
      }
      throw new GitHubApiError(
        response.status === 401
          ? "GitHub token is invalid or expired."
          : `GitHub API error: ${detail}`,
        response.status
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async getUser(): Promise<GitHubUser> {
    const user = await this.request<{
      login: string;
      name: string | null;
      avatar_url: string | null;
    }>("GET", "/user");
    return {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
    };
  }

  async createRepo(
    name: string,
    options: { description?: string; isPrivate?: boolean } = {}
  ): Promise<GitHubRepo> {
    const repo = await this.request<{
      full_name: string;
      html_url: string;
      default_branch: string;
      private: boolean;
    }>("POST", "/user/repos", {
      name,
      description: options.description,
      private: options.isPrivate ?? true,
      auto_init: false,
    });
    return {
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch ?? "main",
      private: repo.private,
    };
  }

  async getRepo(fullName: string): Promise<GitHubRepo> {
    const repo = await this.request<{
      full_name: string;
      html_url: string;
      default_branch: string;
      private: boolean;
    }>("GET", `/repos/${fullName}`);
    return {
      fullName: repo.full_name,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch ?? "main",
      private: repo.private,
    };
  }

  /** Pushes a full file snapshot as one commit. Handles empty repos. */
  async pushFiles(
    fullName: string,
    files: Array<{ path: string; content: string }>,
    message: string,
    branch = "main"
  ): Promise<PushResult> {
    // Base commit (absent on an empty repository).
    let baseCommitSha: string | null = null;
    let baseTreeSha: string | null = null;
    try {
      const ref = await this.request<{ object: { sha: string } }>(
        "GET",
        `/repos/${fullName}/git/ref/heads/${branch}`
      );
      baseCommitSha = ref.object.sha;
      const commit = await this.request<{ tree: { sha: string } }>(
        "GET",
        `/repos/${fullName}/git/commits/${baseCommitSha}`
      );
      baseTreeSha = commit.tree.sha;
    } catch (error) {
      if (!(error instanceof GitHubApiError && error.status === 404)) {
        throw error;
      }
    }

    // Blobs.
    const treeEntries = await Promise.all(
      files.map(async (file) => {
        const blob = await this.request<{ sha: string }>(
          "POST",
          `/repos/${fullName}/git/blobs`,
          {
            content: Buffer.from(file.content, "utf8").toString("base64"),
            encoding: "base64",
          }
        );
        return {
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      })
    );

    // Tree → commit → ref.
    const tree = await this.request<{ sha: string }>(
      "POST",
      `/repos/${fullName}/git/trees`,
      {
        tree: treeEntries,
        ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
      }
    );
    const commit = await this.request<{ sha: string; html_url: string }>(
      "POST",
      `/repos/${fullName}/git/commits`,
      {
        message,
        tree: tree.sha,
        parents: baseCommitSha ? [baseCommitSha] : [],
      }
    );

    if (baseCommitSha) {
      await this.request("PATCH", `/repos/${fullName}/git/refs/heads/${branch}`, {
        sha: commit.sha,
        force: false,
      });
    } else {
      await this.request("POST", `/repos/${fullName}/git/refs`, {
        ref: `refs/heads/${branch}`,
        sha: commit.sha,
      });
    }

    return {
      commitSha: commit.sha,
      commitUrl: commit.html_url,
      fileCount: files.length,
    };
  }

  /** Pulls the branch tree (text blobs, bounded size). */
  async pullFiles(
    fullName: string,
    branch = "main",
    maxFileBytes = 200_000
  ): Promise<Array<{ path: string; content: string }>> {
    const ref = await this.request<{ object: { sha: string } }>(
      "GET",
      `/repos/${fullName}/git/ref/heads/${branch}`
    );
    const commit = await this.request<{ tree: { sha: string } }>(
      "GET",
      `/repos/${fullName}/git/commits/${ref.object.sha}`
    );
    const tree = await this.request<{
      tree: Array<{ path: string; type: string; sha: string; size?: number }>;
      truncated: boolean;
    }>("GET", `/repos/${fullName}/git/trees/${commit.tree.sha}?recursive=1`);

    const blobs = tree.tree.filter(
      (entry) =>
        entry.type === "blob" && (entry.size ?? 0) <= maxFileBytes
    );

    return Promise.all(
      blobs.map(async (entry) => {
        const blob = await this.request<{
          content: string;
          encoding: string;
        }>("GET", `/repos/${fullName}/git/blobs/${entry.sha}`);
        const content =
          blob.encoding === "base64"
            ? Buffer.from(blob.content, "base64").toString("utf8")
            : blob.content;
        return { path: entry.path, content };
      })
    );
  }

  async listCommits(
    fullName: string,
    branch = "main",
    limit = 20
  ): Promise<GitHubCommit[]> {
    const commits = await this.request<
      Array<{
        sha: string;
        html_url: string;
        commit: {
          message: string;
          author: { name: string; date: string } | null;
        };
      }>
    >("GET", `/repos/${fullName}/commits?sha=${branch}&per_page=${limit}`);
    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
      url: c.html_url,
    }));
  }
}
