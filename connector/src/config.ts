import { config as loadEnv } from 'dotenv';

loadEnv();

export type AppConfig = {
  port: number;
  nodeEnv: string;
  vertical: string;
};

export function getConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 4010);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  return {
    port,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    vertical: process.env.VERTICAL ?? 'generic',
  };
}
