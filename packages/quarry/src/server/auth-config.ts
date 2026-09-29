export interface QuarryAuthConfig {
  enabled: boolean;
  token?: string;
}

export function resolveQuarryAuthConfig(config: QuarryAuthConfig): QuarryAuthConfig {
  return {
    enabled: config.enabled,
    token: config.token,
  };
}
