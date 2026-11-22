// The engine is `wikae serve` from this same folder, run by Electron's own Node in a background
// process. It always starts its own with a fresh token at every launch: a server already listening
// is unauthenticated, so this privileged window must never use one.
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { UtilityProcess } from "electron";
import { choose, collectionPath, freePort, lastError, probe, usualPort } from "./find.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface StartOptions {
  /** The Wikae folder: bin/, src/, web/dist/… */
  root: string;
  env: Record<string, string | undefined>;
  log(line: string): void;
  /** What the engine prints. */
  output(chunk: string): void;
}

export class Engine {
  /** Called when an engine this app started stops on its own (75: it restarts after an update). */
  onExit: ((code: number) => void) | null = null;
  readonly origin: string;
  readonly token: string | null;
  readonly collection: string;
  version: string;
  private readonly child: UtilityProcess | null;
  private stopping = false;

  private constructor(origin: string, token: string | null, collection: string, version: string, child: UtilityProcess | null) {
    this.origin = origin;
    this.token = token;
    this.collection = collection;
    this.version = version;
    this.child = child;
  }

  /** True for the engine this app started (always, since it never adopts one from elsewhere). */
  get owned(): boolean {
    return !!this.child;
  }

  /** A URL in the engine, carrying the password; the web app keeps it for its API calls. */
  url(path = "/"): string {
    const u = new URL(path, this.origin);
    if (this.token) u.searchParams.set("token", this.token);
    return u.toString();
  }

  contains(url: string): boolean {
    return url === this.origin || url.startsWith(this.origin + "/");
  }

  stop() {
    this.stopping = true;
    this.child?.kill();
  }

  static async start(o: StartOptions): Promise<Engine> {
    const collection = collectionPath(o.env);
    const usual = usualPort(o.env);
    const found = await probe(usual);
    const plan = choose(found, collection);
    // Always run our own engine with a fresh token. A server already on the port is unauthenticated:
    // anyone on this machine could bind it and feed the privileged window malicious pages.
    const port = plan.reuse || plan.port === "any" ? await freePort() : usual;
    try {
      return await Engine.spawn(o, port, collection);
    } catch (e) {
      // Something took the usual port between the check and the start.
      if (port === usual && /EADDRINUSE/.test(String((e as Error).message))) return Engine.spawn(o, await freePort(), collection);
      throw e;
    }
  }

  private static async spawn(o: StartOptions, port: number, collection: string): Promise<Engine> {
    const { utilityProcess } = await import("electron");
    const token = randomBytes(24).toString("base64url");
    o.log(`starting the engine on port ${port} for ${collection}`);
    const child = utilityProcess.fork(join(o.root, "bin", "wikae.js"), ["serve", "--host", "127.0.0.1", "--port", String(port)], {
      cwd: o.root,
      serviceName: "Wikae engine",
      stdio: "pipe",
      // The password goes in the environment, which other accounts can't read (they can read command
      // lines). ETUDE_SUPERVISED: after an update the engine exits with 75 and the app starts it again.
      env: { ...o.env, ETUDE_TOKEN: token, ETUDE_SUPERVISED: "1", NODE_NO_WARNINGS: "1" },
    });
    let tail = "";
    const keep = (d: Buffer) => {
      const s = d.toString();
      o.output(s);
      tail = (tail + s).slice(-4000);
    };
    child.stdout?.on("data", keep);
    child.stderr?.on("data", keep);
    let exited: number | null = null;
    child.once("exit", (code) => (exited = code));

    const engine = new Engine(`http://127.0.0.1:${port}`, token, collection, "", child);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (exited !== null) throw new Error(lastError(tail) ?? `the engine stopped (exit code ${exited})`);
      const p = await probe(port, token);
      if (p.kind === "etude") {
        engine.version = p.version;
        child.on("exit", (code) => {
          if (!engine.stopping) engine.onExit?.(code);
        });
        return engine;
      }
      await sleep(100);
    }
    engine.stop();
    throw new Error("the engine didn't answer within 30 seconds");
  }
}
