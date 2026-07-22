export type ReadinessResult = {
  ready: boolean;
  release: string;
};

export type ReadinessDependencies = {
  configurationReady: () => boolean;
  databaseReady: () => Promise<boolean>;
  release: () => string;
};

export async function evaluateReadinessChecks(
  dependencies: ReadinessDependencies
): Promise<ReadinessResult> {
  const configOk = dependencies.configurationReady();
  const dbOk = configOk ? await dependencies.databaseReady() : false;

  return {
    ready: configOk && dbOk,
    release: dependencies.release(),
  };
}
