import { AsyncLocalStorage } from "node:async_hooks";

export type ExecutionContext = {
  sessionKey?: string;
  agentId?: string;
  runId?: string;
  toolCallId?: string;
};

class ExecutionContextStoreImpl {
  private store = new AsyncLocalStorage<ExecutionContext>();

  /**
   * Run a function with the specified context. If a context already exists, the new context
   * will be shallowly merged with the existing context, allowing nested scopes (e.g. tools)
   * to inherit session identifiers while overriding specific fields (e.g. toolCallId).
   */
  run<R>(context: Partial<ExecutionContext>, callback: () => R): R {
    const existing = this.store.getStore();
    const merged: ExecutionContext = existing ? { ...existing, ...context } : { ...context };
    return this.store.run(merged, callback);
  }

  /**
   * Run a promise-returning function with the specified context.
   */
  async runAsync<R>(context: Partial<ExecutionContext>, callback: () => Promise<R>): Promise<R> {
    const existing = this.store.getStore();
    const merged: ExecutionContext = existing ? { ...existing, ...context } : { ...context };
    return this.store.run(merged, callback);
  }

  /**
   * Retrieve the current execution context, if any.
   */
  get(): ExecutionContext | undefined;
  /**
   * Retrieve a specific key from the current execution context.
   */
  get<K extends keyof ExecutionContext>(key: K): ExecutionContext[K] | undefined;
  // oxlint-disable-next-line typescript/no-explicit-any
  get(key?: keyof ExecutionContext): any {
    const store = this.store.getStore();
    if (key) {
      return store?.[key];
    }
    return store;
  }
}

export const ExecutionContextStore = new ExecutionContextStoreImpl();
