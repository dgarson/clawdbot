export type PrReviewMonitorConfig = {
  enabled?: boolean;
  /** GitHub repo in owner/name format. */
  repo?: string;
  /** Slack channel or target (ex: "#cb-ideas"). */
  slackChannel?: string;
  /** Bot accounts to monitor (GitHub user logins). */
  botAccounts?: string[];
  /**
   * GitHub API page size for list calls.
   * Defaults to 20 when unset; max is 100.
   */
  pageSize?: number;
};
