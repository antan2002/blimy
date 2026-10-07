export declare function createReactCompilerPreset(): {
  rolldown: {
    filter: {
      code: {
        exclude: RegExp;
      };
      id?: import("rolldown").GeneralHookFilter;
      moduleType?: import("rolldown").ModuleTypeFilter;
    };
    optimizeDeps?: {
      include?: string[];
    };
    applyToEnvironmentHook?: (environment: {
      name: string;
      getTopLevelConfig(): import("vite").ResolvedConfig;
      config: import("vite").ResolvedConfig & {
        input?: import("@voidzero-dev/vite-plus-core/rolldown").InputOption;
        define?: Record<string, any>;
        resolve: Required<import("vite").ResolveOptions>;
        consumer: "client" | "server";
        keepProcessEnv?: boolean;
        optimizeDeps: import("vite").DepOptimizationOptions;
        dev: import("vite").ResolvedDevEnvironmentOptions;
        build: import("vite").ResolvedBuildEnvironmentOptions;
        isBundled: boolean;
        plugins: readonly import("vite").Plugin[];
      };
      logger: import("vite").Logger;
    }) => boolean;
    configResolvedHook?: (config: import("vite").ResolvedConfig) => boolean;
  };
  preset:
    | import("@babel/core").ConfigItem<import("@babel/core").PresetAPI>
    | import("@babel/core").PresetTarget<object>
    | [import("@babel/core").PresetTarget<object>, object]
    | [import("@babel/core").PresetTarget<object>, object, string];
};
