import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function resolveDatabaseHost(host) {
  // wsproxy runs in Docker, so loopback hosts need to point back to the host machine.
  return LOCAL_DATABASE_HOSTS.has(host) ? 'host.docker.internal' : host;
}

neonConfig.webSocketConstructor = ws;
neonConfig.wsProxy = (host, port) =>
  `localhost:5433/v1?address=${resolveDatabaseHost(host)}:${port}`;
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;
