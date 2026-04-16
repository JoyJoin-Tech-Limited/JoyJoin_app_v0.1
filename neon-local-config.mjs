import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
neonConfig.wsProxy = (host, port) => 'localhost:5433/v1?address=host.docker.internal:5432';
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = false;
