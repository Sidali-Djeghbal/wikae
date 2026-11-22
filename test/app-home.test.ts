import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { appEnv, resolveAppHome } from "../src/core/util.ts";
import { chatGptHome } from "../src/core/chatgpt.ts";
import { DEFAULT_CLOUD } from "../src/core/account.ts";

test("namespaced settings prefer Wikae, then Wikaa, then the old Etude name", () => {
  assert.equal(appEnv({}, "SQL"), undefined);
  assert.equal(appEnv({ ETUDE_SQL: "wasm" }, "SQL"), "wasm");
  assert.equal(appEnv({ WIKAA_SQL: "a", ETUDE_SQL: "e" }, "SQL"), "a");
  assert.equal(appEnv({ WIKAE_SQL: "w", WIKAA_SQL: "a", ETUDE_SQL: "e" }, "SQL"), "w");
});

test("the app home and ChatGPT credentials agree, with the Etude fallback intact", () => {
  assert.equal(resolveAppHome({ WIKAE_HOME: "/data/wikae", ETUDE_HOME: "/data/etude" }), resolve("/data/wikae"));
  assert.equal(resolveAppHome({ WIKAA_HOME: "/data/wikaa", ETUDE_HOME: "/data/etude" }), resolve("/data/wikaa"));
  assert.equal(resolveAppHome({ ETUDE_HOME: "/data/etude" }), resolve("/data/etude"));
  const env = { WIKAE_HOME: "/data/wikae" };
  assert.equal(chatGptHome(env), resolveAppHome(env));
  assert.equal(chatGptHome({ ETUDE_HOME: "/data/etude" }), resolve("/data/etude"));
});

test("the default sync server is Wikae's own", () => {
  assert.equal(DEFAULT_CLOUD, "https://sync.wikae.study");
});
