import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  GithubIssueTrackerProvider,
  IssueTrackerRegistry,
  LocalMarkdownIssueTrackerProvider,
  registerIssueTrackingTools,
} from "./src/index.js";

export default function register(api: OpenClawPluginApi) {
  const registry = new IssueTrackerRegistry();
  const localBaseDir = api.resolvePath(".openclaw/issues");
  registry.register(new LocalMarkdownIssueTrackerProvider({ baseDir: localBaseDir }));

  const githubOwner = api.pluginConfig?.githubOwner;
  const githubRepo = api.pluginConfig?.githubRepo;
  const githubToken = api.pluginConfig?.githubToken;
  if (
    typeof githubOwner === "string" &&
    typeof githubRepo === "string" &&
    typeof githubToken === "string"
  ) {
    registry.register(
      new GithubIssueTrackerProvider({
        owner: githubOwner,
        repo: githubRepo,
        token: githubToken,
      }),
    );
  }

  registerIssueTrackingTools(api, registry);
}
