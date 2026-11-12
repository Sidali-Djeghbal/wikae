// /api/account/*: the app's view of the Etude account. Each route maps to one AccountClient call.
import type { Context, Hono } from "hono";
import type { Etude } from "../core/engine.ts";
import { accountFor, AccountError } from "../core/account.ts";

export function accountRoutes(app: Hono, e: Etude) {
  const a = accountFor(e);
  const body = async (c: Context): Promise<any> => {
    try {
      return await c.req.json();
    } catch {
      return {};
    }
  };
  const need = (v: unknown, what: string) => {
    if (typeof v !== "string" || !v.trim()) throw new AccountError(`${what} is required`, 400, "invalid");
    return v;
  };

  app.get("/api/account", async (c) => c.json(await a.status()));
  app.put("/api/account/server", async (c) => c.json(a.setServer(String((await body(c)).server ?? ""))));
  app.post("/api/account/signin", async (c) => c.json(await a.signin(need((await body(c)).email, "email"))));
  app.post("/api/account/verify", async (c) => {
    const b = await body(c);
    return c.json(await a.verify(need(b.code, "code"), b.deviceName, typeof b.email === "string" ? b.email : undefined));
  });
  app.post("/api/account/signout", async (c) => c.json(await a.signout()));

  app.get("/api/account/passkeys", async (c) => c.json(await a.passkeys()));
  app.delete("/api/account/passkeys/:id", async (c) => c.json(await a.removePasskey(c.req.param("id"))));
  app.post("/api/account/passkeys/register/options", async (c) => c.json(await a.passkeyRegisterOptions()));
  app.post("/api/account/passkeys/register/verify", async (c) => c.json(await a.passkeyRegisterVerify(await body(c))));
  app.post("/api/account/passkeys/login/options", async (c) => c.json(await a.passkeyLoginOptions()));
  app.post("/api/account/passkeys/login/verify", async (c) => c.json(await a.passkeyLoginVerify(await body(c))));

  app.get("/api/account/devices", async (c) => c.json(await a.devices()));
  app.patch("/api/account/devices/:id", async (c) => c.json(await a.renameDevice(c.req.param("id"), need((await body(c)).name, "name"))));
  app.delete("/api/account/devices/:id", async (c) => c.json(await a.revokeDevice(c.req.param("id"))));

  app.get("/api/account/email", async (c) => c.json(await a.emailPending()));
  app.post("/api/account/email/start", async (c) => c.json(await a.emailStart(need((await body(c)).email, "email"))));
  app.post("/api/account/email/verify", async (c) => c.json(await a.emailVerify(need((await body(c)).code, "code"))));
  app.delete("/api/account/email", async (c) => c.json(await a.emailCancel()));

  app.get("/api/account/export", async (c) => {
    const data = await a.exportData();
    c.header("Content-Disposition", `attachment; filename="etude-account-${new Date().toISOString().slice(0, 10)}.json"`);
    c.header("Cache-Control", "no-store");
    return c.json(data);
  });
  app.post("/api/account/delete", async (c) => c.json(await a.deleteAccount(String((await body(c)).confirm ?? ""))));
}
