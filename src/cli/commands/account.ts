import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { accountFor, AccountError } from "../../core/account.ts";
import { command, group, CliError } from "../registry.ts";

group({ name: "account", summary: "Etude account: sign-in, devices, passkeys and Sync", defaultVerb: "status" });

const a = (c: { e: any }) => accountFor(c.e);

/** Server answers become CLI errors with the matching exit code. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AccountError) {
      const code = e.status === 404 ? "not_found" : e.status === 409 ? "conflict" : e.status === 502 || e.status >= 500 ? "external" : e.status === 400 || e.status === 422 ? "validation" : "usage";
      throw new CliError(e.message, code, { status: e.status, code: e.code });
    }
    throw e;
  }
}

command({ name: "account status", summary: "Server, sign-in state, account and Sync storage.", output: "{ server, offering, signedIn, email, me, billing, vault }", run: (c) => call(() => a(c).status()) });
command({
  name: "account server",
  summary: "Show or change the Etude server this install uses (default https://sync.etude.study, or $ETUDE_CLOUD_URL).",
  args: [{ name: "url", description: "Server address. Empty string goes back to the default." }],
  writes: true,
  examples: ["etude account server", "etude account server http://localhost:4870"],
  output: "{ server }",
  run: (c) => (c.args.url === undefined ? { server: a(c).server() } : call(async () => a(c).setServer(c.args.url))),
});
command({ name: "account signin", summary: "Email a one-time 6-digit sign-in code (valid 15 minutes).", args: [{ name: "email", description: "Account email.", required: true }], writes: true, output: "{ ok, server, email }", run: (c) => call(() => a(c).signin(c.args.email)) });
command({ name: "account verify", summary: "Redeem the 6-digit code from the sign-in email. When already signed in, it re-confirms this device.", description: "The code goes with the address from the last `account signin` (or --email). Spaces are fine (`482 913`). A long token from the email's link works too. A code allows 5 wrong tries, then ask for a new one.", args: [{ name: "code", description: "The 6-digit code from the email (or the link's token).", required: true }], flags: [{ name: "name", type: "string", description: "Name for this device." }, { name: "email", type: "string", description: "The address the code was sent to, if not the last `account signin`." }], writes: true, output: "{ reauth, email }", examples: ["etude account signin you@example.com", "etude account verify \"482 913\""], run: (c) => call(() => a(c).verify(c.args.code, c.flags.name, c.flags.email)) });
command({ name: "account signout", summary: "Sign this device out of the account. Local data stays.", writes: true, output: "{ signedIn }", run: (c) => call(() => a(c).signout()) });
command({ name: "account devices", summary: "Devices signed in to the account.", output: "{ devices: [{ id, name, via, created, lastSeen, current }] }", run: (c) => call(() => a(c).devices()) });
command({ name: "account revoke", summary: "Sign a device out. Another device needs a sign-in on this one within 10 minutes.", args: [{ name: "device", description: "Device id.", required: true }], writes: true, output: "{ ok }", run: (c) => call(() => a(c).revokeDevice(c.args.device)) });
command({ name: "account passkeys", summary: "Passkeys on the account (add them in Settings → Account; the browser holds them).", output: "{ passkeys }", run: (c) => call(() => a(c).passkeys()) });
command({ name: "account email", summary: "Start an email change: a link goes to the new address. Needs a recent sign-in.", args: [{ name: "email", description: "New address.", required: true }], writes: true, output: "{ ok, expiresIn }", run: (c) => call(() => a(c).emailStart(c.args.email)) });
command({ name: "account email-confirm", summary: "Confirm an email change with the code from the link.", args: [{ name: "code", description: "Code from the link.", required: true }], writes: true, output: "{ ok, email }", run: (c) => call(() => a(c).emailVerify(c.args.code)) });
command({
  name: "account export",
  summary: "Download everything the server holds about the account (JSON).",
  flags: [{ name: "out", type: "string", short: "o", description: "Write it to this file instead of stdout.", placeholder: "FILE" }],
  output: "the export, or { written }",
  run: (c) =>
    call(async () => {
      const data = await a(c).exportData();
      if (!c.flags.out) return data;
      const path = resolve(c.flags.out);
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
      return { written: path };
    }),
});
command({
  name: "account delete",
  summary: "Delete the account on the server: devices, passkeys and the Sync vault. Local data stays.",
  description: "Needs a sign-in on this device within the last 10 minutes (`account signin` + `account verify`), the account's email as --confirm, and --yes.",
  flags: [{ name: "confirm", type: "string", description: "The account's email address." }],
  writes: true,
  confirm: true,
  output: "{ ok, deleted }",
  run: (c) => call(() => a(c).deleteAccount(c.flags.confirm ?? "")),
});
