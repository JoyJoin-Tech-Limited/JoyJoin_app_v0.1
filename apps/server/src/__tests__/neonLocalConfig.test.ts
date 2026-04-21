import { afterEach, describe, expect, it, vi } from 'vitest';
import { neonConfig } from '@neondatabase/serverless';

type NeonConfigSnapshot = {
  webSocketConstructor: typeof neonConfig.webSocketConstructor;
  wsProxy: typeof neonConfig.wsProxy;
  useSecureWebSocket: typeof neonConfig.useSecureWebSocket;
  pipelineTLS: typeof neonConfig.pipelineTLS;
  pipelineConnect: typeof neonConfig.pipelineConnect;
};

function snapshotNeonConfig(): NeonConfigSnapshot {
  return {
    webSocketConstructor: neonConfig.webSocketConstructor,
    wsProxy: neonConfig.wsProxy,
    useSecureWebSocket: neonConfig.useSecureWebSocket,
    pipelineTLS: neonConfig.pipelineTLS,
    pipelineConnect: neonConfig.pipelineConnect,
  };
}

function restoreNeonConfig(snapshot: NeonConfigSnapshot) {
  neonConfig.webSocketConstructor = snapshot.webSocketConstructor;
  neonConfig.wsProxy = snapshot.wsProxy;
  neonConfig.useSecureWebSocket = snapshot.useSecureWebSocket;
  neonConfig.pipelineTLS = snapshot.pipelineTLS;
  neonConfig.pipelineConnect = snapshot.pipelineConnect;
}

function resolveProxyUrl(host: string, port: number | string) {
  const { wsProxy } = neonConfig;
  return typeof wsProxy === 'function' ? wsProxy(host, port) : `${wsProxy}?address=${host}:${port}`;
}

const originalConfig = snapshotNeonConfig();

afterEach(() => {
  restoreNeonConfig(originalConfig);
});

describe('neon-local-config', () => {
  it('routes websocket proxy traffic to the requested database host and port', async () => {
    vi.resetModules();

    await import('../../../../neon-local-config.mjs');

    expect(resolveProxyUrl('db.example.com', 6543)).toBe(
      'localhost:5433/v1?address=db.example.com:6543',
    );
  });
});
