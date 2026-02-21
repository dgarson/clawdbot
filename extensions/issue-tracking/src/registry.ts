import type { IssueTrackerProvider } from "./provider.js";

export class IssueTrackerRegistry {
  readonly #providers = new Map<string, IssueTrackerProvider>();

  register(provider: IssueTrackerProvider): void {
    this.#providers.set(provider.id, provider);
  }

  get(providerId: string): IssueTrackerProvider | null {
    return this.#providers.get(providerId) ?? null;
  }

  list(): IssueTrackerProvider[] {
    return [...this.#providers.values()];
  }
}
