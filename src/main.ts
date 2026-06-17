import { env } from './config/env';
import { closeFabricClient } from './modules/fabric/fabric.service';
import { app } from './app';

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on port ${env.PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);

  server.close((): void => {
    closeFabricClient();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
