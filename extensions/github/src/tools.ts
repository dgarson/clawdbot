import { Type } from "@sinclair/typebox";
import {
  jsonResult,
  optionalStringEnum,
  readNumberParam,
  readStringParam,
  stringEnum,
  type AnyAgentTool,
  type OpenClawPluginApi,
} from "openclaw/plugin-sdk";
import {
  assertRepoAllowed,
  buildQuery,
  buildRepoEndpoint,
  ghApiJson,
  normalizePositiveInt,
  readBoolean,
  resolveGithubPluginConfig,
  resolveRepoSlug,
  truncateText,
  type GithubPermission,
  type GithubPluginConfig,
} from "./client.js";

const COMMENT_KINDS = ["issue", "review", "all"] as const;
const PR_STATES = ["open", "closed", "all"] as const;
const PR_SORTS = ["created", "updated", "popularity", "long-running"] as const;
const PR_DIRECTIONS = ["asc", "desc"] as const;
const MERGE_METHODS = ["merge", "squash", "rebase"] as const;
const COMMENT_SIDES = ["LEFT", "RIGHT"] as const;

const RepoParam = Type.Optional(
  Type.String({
    description:
      "GitHub repository slug in owner/repo format. If omitted, tries the current gh context.",
  }),
);

const NumberIdParam = Type.Number({ minimum: 1 });

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return value as Record<string, unknown>;
}

async function withHandledResult(
  action: string,
  fn: () => Promise<Record<string, unknown>>,
): Promise<ReturnType<typeof jsonResult>> {
  try {
    const data = await fn();
    return jsonResult({ ok: true, action, ...data });
  } catch (error) {
    return jsonResult({
      ok: false,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function resolveRepoForPermission(params: {
  api: OpenClawPluginApi;
  config: GithubPluginConfig;
  args: Record<string, unknown>;
  permission: GithubPermission;
}): Promise<string> {
  const repo = await resolveRepoSlug({
    api: params.api,
    repoRaw: params.args.repo,
    timeoutMs: params.config.timeoutMs,
  });
  assertRepoAllowed({ repo, config: params.config, permission: params.permission });
  return repo;
}

function normalizeFiles(
  rawFiles: unknown,
  options: {
    includePatch: boolean;
    maxFiles: number;
    maxPatchChars: number;
  },
): Array<Record<string, unknown>> {
  if (!Array.isArray(rawFiles)) {
    return [];
  }

  const files = rawFiles
    .filter((entry) => entry && typeof entry === "object")
    .slice(0, options.maxFiles)
    .map((entry) => {
      const file = { ...(entry as Record<string, unknown>) };
      if (!options.includePatch) {
        delete file.patch;
        return file;
      }

      const patch = file.patch;
      if (typeof patch === "string") {
        file.patch = truncateText(patch, options.maxPatchChars);
      }
      return file;
    });

  return files;
}

function pickTextEnum<T extends readonly string[]>(
  value: string | undefined,
  values: T,
  fallback: T[number],
): T[number] {
  if (!value) {
    return fallback;
  }
  return values.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function readPositiveIntArg(
  args: Record<string, unknown>,
  key: string,
  options: { required?: boolean } = {},
): number {
  const value = readNumberParam(args, key, {
    required: options.required,
    integer: true,
  });
  if (typeof value !== "number" || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
}

const CommitShowSchema = Type.Object(
  {
    repo: RepoParam,
    ref: Type.String({ description: "Commit SHA or git ref to inspect" }),
    includePatch: Type.Optional(Type.Boolean()),
    maxFiles: Type.Optional(Type.Number({ minimum: 1, maximum: 300 })),
    maxPatchChars: Type.Optional(Type.Number({ minimum: 200 })),
  },
  { additionalProperties: false },
);

const DiffCompareSchema = Type.Object(
  {
    repo: RepoParam,
    base: Type.String({ description: "Base commit/branch/tag" }),
    head: Type.String({ description: "Head commit/branch/tag" }),
    includePatch: Type.Optional(Type.Boolean()),
    maxFiles: Type.Optional(Type.Number({ minimum: 1, maximum: 300 })),
    maxPatchChars: Type.Optional(Type.Number({ minimum: 200 })),
  },
  { additionalProperties: false },
);

const PrListSchema = Type.Object(
  {
    repo: RepoParam,
    state: optionalStringEnum(PR_STATES, { description: "PR state filter" }),
    base: Type.Optional(Type.String()),
    head: Type.Optional(Type.String()),
    sort: optionalStringEnum(PR_SORTS, { description: "Sort field" }),
    direction: optionalStringEnum(PR_DIRECTIONS, { description: "Sort direction" }),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

const PrNumberSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
  },
  { additionalProperties: false },
);

const PrViewSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
    includeFiles: Type.Optional(Type.Boolean()),
    includeReviews: Type.Optional(Type.Boolean()),
    includeCommits: Type.Optional(Type.Boolean()),
    maxFiles: Type.Optional(Type.Number({ minimum: 1, maximum: 300 })),
    maxPatchChars: Type.Optional(Type.Number({ minimum: 200 })),
  },
  { additionalProperties: false },
);

const PrChecksSchema = PrNumberSchema;

const PrCommentsListSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
    kind: optionalStringEnum(COMMENT_KINDS, {
      description: "Which comment types to fetch (issue, review, or all)",
    }),
    limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

const PrCommentCreateSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
    kind: optionalStringEnum(["issue", "review"] as const, {
      description:
        "Issue comments are top-level conversation comments. Review comments are file-line comments.",
    }),
    body: Type.String({ description: "Markdown comment body" }),
    commitId: Type.Optional(Type.String({ description: "Required for new review comments" })),
    path: Type.Optional(Type.String({ description: "Required for new review comments" })),
    line: Type.Optional(Type.Number({ minimum: 1 })),
    side: optionalStringEnum(COMMENT_SIDES),
    startLine: Type.Optional(Type.Number({ minimum: 1 })),
    startSide: optionalStringEnum(COMMENT_SIDES),
    inReplyTo: Type.Optional(Type.Number({ minimum: 1 })),
  },
  { additionalProperties: false },
);

const PrCommentEditSchema = Type.Object(
  {
    repo: RepoParam,
    commentId: NumberIdParam,
    kind: stringEnum(["issue", "review"] as const),
    body: Type.String({ description: "New markdown comment body" }),
  },
  { additionalProperties: false },
);

const PrCommentDeleteSchema = Type.Object(
  {
    repo: RepoParam,
    commentId: NumberIdParam,
    kind: stringEnum(["issue", "review"] as const),
  },
  { additionalProperties: false },
);

const PrCreateSchema = Type.Object(
  {
    repo: RepoParam,
    title: Type.String(),
    head: Type.String({ description: "Head branch name or owner:branch" }),
    base: Type.String({ description: "Base branch name" }),
    body: Type.Optional(Type.String()),
    draft: Type.Optional(Type.Boolean()),
    maintainerCanModify: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const PrEditSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
    title: Type.Optional(Type.String()),
    body: Type.Optional(Type.String()),
    base: Type.Optional(Type.String()),
    maintainerCanModify: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const PrUpdateBranchSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
    expectedHeadSha: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const PrMergeSchema = Type.Object(
  {
    repo: RepoParam,
    number: NumberIdParam,
    method: optionalStringEnum(MERGE_METHODS),
    commitTitle: Type.Optional(Type.String()),
    commitMessage: Type.Optional(Type.String()),
    sha: Type.Optional(Type.String({ description: "Expected head SHA to merge" })),
    deleteBranch: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

function createCommitShowTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_commit_show",
    label: "GitHub Commit Show",
    description: "Show a commit with metadata, stats, and changed files.",
    parameters: CommitShowSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_commit_show", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "read",
        });

        const ref = readStringParam(params, "ref", { required: true });
        const endpoint = buildRepoEndpoint(repo, `commits/${encodeURIComponent(ref)}`);
        const commit = asRecord(
          await ghApiJson({
            api,
            endpoint,
            timeoutMs: config.timeoutMs,
          }),
        );

        const includePatch = readBoolean(params.includePatch, true);
        const maxFiles = normalizePositiveInt(params.maxFiles, config.maxFiles, 300);
        const maxPatchChars = normalizePositiveInt(params.maxPatchChars, config.maxPatchChars);
        const files = normalizeFiles(commit.files, {
          includePatch,
          maxFiles,
          maxPatchChars,
        });

        return {
          repo,
          commit: {
            ...commit,
            files,
          },
        };
      }),
  };
}

function createDiffCompareTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_diff_compare",
    label: "GitHub Diff Compare",
    description: "Compare two refs and return changed files, commits, and stats.",
    parameters: DiffCompareSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_diff_compare", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "read",
        });
        const base = readStringParam(params, "base", { required: true });
        const head = readStringParam(params, "head", { required: true });
        const endpoint = buildRepoEndpoint(
          repo,
          `compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
        );

        const comparison = asRecord(
          await ghApiJson({
            api,
            endpoint,
            timeoutMs: config.timeoutMs,
          }),
        );

        const includePatch = readBoolean(params.includePatch, true);
        const maxFiles = normalizePositiveInt(params.maxFiles, config.maxFiles, 300);
        const maxPatchChars = normalizePositiveInt(params.maxPatchChars, config.maxPatchChars);

        return {
          repo,
          base,
          head,
          comparison: {
            ...comparison,
            files: normalizeFiles(comparison.files, { includePatch, maxFiles, maxPatchChars }),
          },
        };
      }),
  };
}

function createPrListTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_list",
    label: "GitHub PR List",
    description: "List pull requests for a repository.",
    parameters: PrListSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_list", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "read",
        });

        const state = pickTextEnum(readStringParam(params, "state"), PR_STATES, "open");
        const sort = pickTextEnum(readStringParam(params, "sort"), PR_SORTS, "updated");
        const direction = pickTextEnum(readStringParam(params, "direction"), PR_DIRECTIONS, "desc");
        const limit = normalizePositiveInt(params.limit, 20, 100);

        const query = buildQuery({
          state,
          base: readStringParam(params, "base"),
          head: readStringParam(params, "head"),
          sort,
          direction,
          per_page: limit,
        });

        const pulls = await ghApiJson<unknown[]>({
          api,
          endpoint: `${buildRepoEndpoint(repo, "pulls")}${query}`,
          timeoutMs: config.timeoutMs,
        });

        return {
          repo,
          state,
          count: Array.isArray(pulls) ? pulls.length : 0,
          pulls,
        };
      }),
  };
}

function createPrViewTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_view",
    label: "GitHub PR View",
    description: "Fetch full pull request details, optionally including files/reviews/commits.",
    parameters: PrViewSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_view", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "read",
        });
        const number = readPositiveIntArg(params, "number", { required: true });

        const includeFiles = readBoolean(params.includeFiles, true);
        const includeReviews = readBoolean(params.includeReviews, false);
        const includeCommits = readBoolean(params.includeCommits, false);
        const maxFiles = normalizePositiveInt(params.maxFiles, config.maxFiles, 300);
        const maxPatchChars = normalizePositiveInt(params.maxPatchChars, config.maxPatchChars);

        const pull = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}`),
          timeoutMs: config.timeoutMs,
        });

        let files: unknown[] | undefined;
        if (includeFiles) {
          const rawFiles = await ghApiJson({
            api,
            endpoint: `${buildRepoEndpoint(repo, `pulls/${number}/files`)}${buildQuery({ per_page: maxFiles })}`,
            timeoutMs: config.timeoutMs,
          });
          files = normalizeFiles(rawFiles, { includePatch: true, maxFiles, maxPatchChars });
        }

        let reviews: unknown[] | undefined;
        if (includeReviews) {
          reviews = await ghApiJson({
            api,
            endpoint: `${buildRepoEndpoint(repo, `pulls/${number}/reviews`)}${buildQuery({ per_page: 100 })}`,
            timeoutMs: config.timeoutMs,
          });
        }

        let commits: unknown[] | undefined;
        if (includeCommits) {
          commits = await ghApiJson({
            api,
            endpoint: `${buildRepoEndpoint(repo, `pulls/${number}/commits`)}${buildQuery({ per_page: 100 })}`,
            timeoutMs: config.timeoutMs,
          });
        }

        return {
          repo,
          number,
          pull,
          files,
          reviews,
          commits,
        };
      }),
  };
}

function createPrChecksTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_checks",
    label: "GitHub PR Checks",
    description: "Fetch commit status contexts and check-runs for a PR head SHA.",
    parameters: PrChecksSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_checks", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "read",
        });
        const number = readPositiveIntArg(params, "number", { required: true });

        const pull = asRecord(
          await ghApiJson({
            api,
            endpoint: buildRepoEndpoint(repo, `pulls/${number}`),
            timeoutMs: config.timeoutMs,
          }),
        );
        const head = asRecord(pull.head);
        const sha = readStringParam(head, "sha", { required: true });

        const status = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `commits/${encodeURIComponent(sha)}/status`),
          timeoutMs: config.timeoutMs,
        });

        const checkRuns = await ghApiJson({
          api,
          endpoint: `${buildRepoEndpoint(repo, `commits/${encodeURIComponent(sha)}/check-runs`)}${buildQuery({ per_page: 100 })}`,
          timeoutMs: config.timeoutMs,
        });

        return {
          repo,
          number,
          sha,
          status,
          checkRuns,
        };
      }),
  };
}

function createPrCommentsListTool(
  api: OpenClawPluginApi,
  config: GithubPluginConfig,
): AnyAgentTool {
  return {
    name: "github_pr_comments_list",
    label: "GitHub PR Comments List",
    description: "List issue and/or review comments on a pull request.",
    parameters: PrCommentsListSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_comments_list", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "read",
        });
        const number = readPositiveIntArg(params, "number", { required: true });
        const kind = pickTextEnum(readStringParam(params, "kind"), COMMENT_KINDS, "all");
        const limit = normalizePositiveInt(params.limit, 50, 100);

        let issueComments: unknown[] | undefined;
        let reviewComments: unknown[] | undefined;

        if (kind === "issue" || kind === "all") {
          issueComments = await ghApiJson({
            api,
            endpoint: `${buildRepoEndpoint(repo, `issues/${number}/comments`)}${buildQuery({ per_page: limit })}`,
            timeoutMs: config.timeoutMs,
          });
        }

        if (kind === "review" || kind === "all") {
          reviewComments = await ghApiJson({
            api,
            endpoint: `${buildRepoEndpoint(repo, `pulls/${number}/comments`)}${buildQuery({ per_page: limit })}`,
            timeoutMs: config.timeoutMs,
          });
        }

        return {
          repo,
          number,
          kind,
          issueComments,
          reviewComments,
        };
      }),
  };
}

function createPrCommentCreateTool(
  api: OpenClawPluginApi,
  config: GithubPluginConfig,
): AnyAgentTool {
  return {
    name: "github_pr_comment_create",
    label: "GitHub PR Comment Create",
    description: "Create an issue or review comment on a pull request.",
    parameters: PrCommentCreateSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_comment_create", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const number = readPositiveIntArg(params, "number", { required: true });
        const body = readStringParam(params, "body", { required: true });
        const kind = pickTextEnum(
          readStringParam(params, "kind"),
          ["issue", "review"] as const,
          "issue",
        );

        if (kind === "issue") {
          const comment = await ghApiJson({
            api,
            endpoint: buildRepoEndpoint(repo, `issues/${number}/comments`),
            method: "POST",
            timeoutMs: config.timeoutMs,
            body: { body },
          });
          return { repo, number, kind, comment };
        }

        const inReplyTo = readNumberParam(params, "inReplyTo", { integer: true });
        const payload: Record<string, unknown> = { body };

        if (typeof inReplyTo === "number" && inReplyTo > 0) {
          payload.in_reply_to = inReplyTo;
        } else {
          const commitId = readStringParam(params, "commitId", { required: true });
          const path = readStringParam(params, "path", { required: true });
          const line = readPositiveIntArg(params, "line", { required: true });
          payload.commit_id = commitId;
          payload.path = path;
          payload.line = line;

          const side = readStringParam(params, "side");
          if (side && COMMENT_SIDES.includes(side as (typeof COMMENT_SIDES)[number])) {
            payload.side = side;
          }

          const startLine = readNumberParam(params, "startLine", { integer: true });
          if (typeof startLine === "number" && startLine > 0) {
            payload.start_line = startLine;
          }

          const startSide = readStringParam(params, "startSide");
          if (startSide && COMMENT_SIDES.includes(startSide as (typeof COMMENT_SIDES)[number])) {
            payload.start_side = startSide;
          }
        }

        const comment = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}/comments`),
          method: "POST",
          timeoutMs: config.timeoutMs,
          body: payload,
        });

        return {
          repo,
          number,
          kind,
          comment,
        };
      }),
  };
}

function createPrCommentEditTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_comment_edit",
    label: "GitHub PR Comment Edit",
    description: "Edit an issue or review comment by id.",
    parameters: PrCommentEditSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_comment_edit", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });
        const commentId = readPositiveIntArg(params, "commentId", { required: true });
        const body = readStringParam(params, "body", { required: true });
        const kind = pickTextEnum(
          readStringParam(params, "kind", { required: true }),
          ["issue", "review"] as const,
          "issue",
        );

        const endpoint =
          kind === "issue"
            ? buildRepoEndpoint(repo, `issues/comments/${commentId}`)
            : buildRepoEndpoint(repo, `pulls/comments/${commentId}`);

        const comment = await ghApiJson({
          api,
          endpoint,
          method: "PATCH",
          timeoutMs: config.timeoutMs,
          body: { body },
        });

        return {
          repo,
          kind,
          commentId,
          comment,
        };
      }),
  };
}

function createPrCommentDeleteTool(
  api: OpenClawPluginApi,
  config: GithubPluginConfig,
): AnyAgentTool {
  return {
    name: "github_pr_comment_delete",
    label: "GitHub PR Comment Delete",
    description: "Delete an issue or review comment by id.",
    parameters: PrCommentDeleteSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_comment_delete", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const commentId = readPositiveIntArg(params, "commentId", { required: true });
        const kind = pickTextEnum(
          readStringParam(params, "kind", { required: true }),
          ["issue", "review"] as const,
          "issue",
        );

        const endpoint =
          kind === "issue"
            ? buildRepoEndpoint(repo, `issues/comments/${commentId}`)
            : buildRepoEndpoint(repo, `pulls/comments/${commentId}`);

        await ghApiJson({
          api,
          endpoint,
          method: "DELETE",
          timeoutMs: config.timeoutMs,
        });

        return {
          repo,
          kind,
          commentId,
          deleted: true,
        };
      }),
  };
}

function createPrCreateTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_create",
    label: "GitHub PR Create",
    description: "Create a pull request.",
    parameters: PrCreateSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_create", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const title = readStringParam(params, "title", { required: true });
        const head = readStringParam(params, "head", { required: true });
        const base = readStringParam(params, "base", { required: true });

        const body = readStringParam(params, "body");
        const draft = typeof params.draft === "boolean" ? params.draft : undefined;
        const maintainerCanModify =
          typeof params.maintainerCanModify === "boolean" ? params.maintainerCanModify : undefined;

        const pull = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, "pulls"),
          method: "POST",
          timeoutMs: config.timeoutMs,
          body: {
            title,
            head,
            base,
            body,
            draft,
            maintainer_can_modify: maintainerCanModify,
          },
        });

        return {
          repo,
          pull,
        };
      }),
  };
}

function createPrEditTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_edit",
    label: "GitHub PR Edit",
    description: "Edit an existing pull request title/body/base/options.",
    parameters: PrEditSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_edit", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const number = readPositiveIntArg(params, "number", { required: true });

        const payload: Record<string, unknown> = {};
        const title = readStringParam(params, "title");
        if (title !== undefined) {
          payload.title = title;
        }
        const body = readStringParam(params, "body", { allowEmpty: true });
        if (body !== undefined) {
          payload.body = body;
        }
        const base = readStringParam(params, "base");
        if (base !== undefined) {
          payload.base = base;
        }
        if (typeof params.maintainerCanModify === "boolean") {
          payload.maintainer_can_modify = params.maintainerCanModify;
        }

        if (Object.keys(payload).length === 0) {
          throw new Error(
            "At least one editable field is required (title, body, base, maintainerCanModify)",
          );
        }

        const pull = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}`),
          method: "PATCH",
          timeoutMs: config.timeoutMs,
          body: payload,
        });

        return {
          repo,
          number,
          pull,
        };
      }),
  };
}

function createPrUpdateBranchTool(
  api: OpenClawPluginApi,
  config: GithubPluginConfig,
): AnyAgentTool {
  return {
    name: "github_pr_update_branch",
    label: "GitHub PR Update Branch",
    description: "Update a pull request branch with the latest base branch changes.",
    parameters: PrUpdateBranchSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_update_branch", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const number = readPositiveIntArg(params, "number", { required: true });
        const expectedHeadSha = readStringParam(params, "expectedHeadSha");

        const result = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}/update-branch`),
          method: "PUT",
          timeoutMs: config.timeoutMs,
          body: expectedHeadSha ? { expected_head_sha: expectedHeadSha } : undefined,
        });

        return {
          repo,
          number,
          result,
        };
      }),
  };
}

function createPrCloseTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_close",
    label: "GitHub PR Close",
    description: "Close a pull request.",
    parameters: PrNumberSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_close", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const number = readPositiveIntArg(params, "number", { required: true });
        const pull = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}`),
          method: "PATCH",
          timeoutMs: config.timeoutMs,
          body: { state: "closed" },
        });

        return {
          repo,
          number,
          pull,
        };
      }),
  };
}

function createPrReopenTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_reopen",
    label: "GitHub PR Reopen",
    description: "Reopen a pull request.",
    parameters: PrNumberSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_reopen", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "write",
        });

        const number = readPositiveIntArg(params, "number", { required: true });
        const pull = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}`),
          method: "PATCH",
          timeoutMs: config.timeoutMs,
          body: { state: "open" },
        });

        return {
          repo,
          number,
          pull,
        };
      }),
  };
}

function createPrMergeTool(api: OpenClawPluginApi, config: GithubPluginConfig): AnyAgentTool {
  return {
    name: "github_pr_merge",
    label: "GitHub PR Merge",
    description: "Merge a pull request (highest-risk GitHub write operation).",
    parameters: PrMergeSchema,
    execute: async (_toolCallId, args) =>
      await withHandledResult("github_pr_merge", async () => {
        const params = asRecord(args);
        const repo = await resolveRepoForPermission({
          api,
          config,
          args: params,
          permission: "merge",
        });

        const number = readPositiveIntArg(params, "number", { required: true });
        const method = pickTextEnum(readStringParam(params, "method"), MERGE_METHODS, "squash");
        const commitTitle = readStringParam(params, "commitTitle");
        const commitMessage = readStringParam(params, "commitMessage", { allowEmpty: true });
        const sha = readStringParam(params, "sha");
        const deleteBranch = readBoolean(params.deleteBranch, false);

        const payload: Record<string, unknown> = {
          merge_method: method,
        };
        if (commitTitle !== undefined) {
          payload.commit_title = commitTitle;
        }
        if (commitMessage !== undefined) {
          payload.commit_message = commitMessage;
        }
        if (sha !== undefined) {
          payload.sha = sha;
        }

        const mergeResult = await ghApiJson({
          api,
          endpoint: buildRepoEndpoint(repo, `pulls/${number}/merge`),
          method: "PUT",
          timeoutMs: config.timeoutMs,
          body: payload,
        });

        let deleteBranchResult: Record<string, unknown> | undefined;

        if (deleteBranch) {
          const pull = asRecord(
            await ghApiJson({
              api,
              endpoint: buildRepoEndpoint(repo, `pulls/${number}`),
              timeoutMs: config.timeoutMs,
            }),
          );
          const head = asRecord(pull.head);
          const headRepo = asRecord(head.repo);
          const headRepoFullName = readStringParam(headRepo, "full_name");
          const headRef = readStringParam(head, "ref");

          if (!headRepoFullName || !headRef) {
            deleteBranchResult = {
              deleted: false,
              reason: "missing head repository or branch ref",
            };
          } else if (headRepoFullName.toLowerCase() !== repo.toLowerCase()) {
            deleteBranchResult = {
              deleted: false,
              reason: "head branch belongs to a fork; remote branch deletion skipped",
              headRepo: headRepoFullName,
            };
          } else {
            await ghApiJson({
              api,
              endpoint: buildRepoEndpoint(repo, `git/refs/heads/${encodeURIComponent(headRef)}`),
              method: "DELETE",
              timeoutMs: config.timeoutMs,
            });
            deleteBranchResult = { deleted: true, branch: headRef };
          }
        }

        return {
          repo,
          number,
          method,
          merge: mergeResult,
          deleteBranch: deleteBranchResult,
        };
      }),
  };
}

export function createGithubTools(api: OpenClawPluginApi): AnyAgentTool[] {
  const config = resolveGithubPluginConfig(api.pluginConfig);

  return [
    createCommitShowTool(api, config),
    createDiffCompareTool(api, config),
    createPrListTool(api, config),
    createPrViewTool(api, config),
    createPrChecksTool(api, config),
    createPrCommentsListTool(api, config),
    createPrCommentCreateTool(api, config),
    createPrCommentEditTool(api, config),
    createPrCommentDeleteTool(api, config),
    createPrCreateTool(api, config),
    createPrEditTool(api, config),
    createPrUpdateBranchTool(api, config),
    createPrCloseTool(api, config),
    createPrReopenTool(api, config),
    createPrMergeTool(api, config),
  ];
}
