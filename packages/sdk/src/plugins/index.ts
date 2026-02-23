export interface PluginModule {
  name: string;
  description: string;
  supportsRuntime: (runtimeName: string) => boolean;
}

export interface ToolPluginClient {
  name: string;
  invoke: (name: string, input: unknown) => Promise<unknown>;
}

export const definePlugin = (name: string, description: string): PluginModule => {
  return {
    name,
    description,
    supportsRuntime: (runtimeName) => runtimeName.length > 0,
  };
};
