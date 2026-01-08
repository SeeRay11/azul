import path from "node:path";
import { IPCServer } from "./ipc/server.js";
import { config } from "./config.js";
import { log } from "./util/log.js";
import type { InstanceData } from "./ipc/messages.js";
import { SnapshotBuilder } from "./snapshot.js";

interface BuildOptions {
  syncDir?: string;
}

export class BuildCommand {
  private ipc: IPCServer;
  private syncDir: string;

  constructor(options: BuildOptions = {}) {
    this.syncDir = path.resolve(options.syncDir ?? config.syncDir);
    this.ipc = new IPCServer(config.port, undefined, {
      requestSnapshotOnConnect: false,
    });
  }

  public async run(): Promise<void> {
    log.info(`Preparing build snapshot from ${this.syncDir}`);
    const builder = new SnapshotBuilder({
      sourceDir: this.syncDir,
      destPrefix: [],
      skipSymlinks: true,
    });
    const instances = await builder.build();
    log.info(`Waiting for Studio to connect on port ${config.port}...`);

    await new Promise<void>((resolve) => {
      this.ipc.onConnection(() => {
        log.info("Studio connected. Sending build snapshot...");
        this.ipc.send({ type: "buildSnapshot", data: instances });
        log.success(`Sent ${instances.length} instances`);
        setTimeout(() => {
          this.ipc.close();
          resolve();
        }, 200);
      });
    });
  }
}
