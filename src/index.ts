import { Client } from './client';
import { env as ENV } from './env';

const client = new Client(ENV);

(async () => {
  try {
    await client.loadEvents();
    await client.start();
    await client.deployCommands();
  } catch (error) {
    console.error("Error starting the bot:", error);
  }
})();
