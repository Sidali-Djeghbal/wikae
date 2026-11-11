import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { aiVerdict, aiFeedback, aiEditFields, aiGenerateItems, type AiSettings, type GradingContext } from "../src/core/ai.ts";
import type { CardTypeDef } from "../src/core/model.ts";

// A stub provider: records request bodies and replies with the handler's result.
type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string> };

async function stub(handler: (body: any) => Reply) {
  const bodies: any[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    bodies.push(body);
    const out = handler(body);
    res.writeHead(out.status ?? 200, { "content-type": "application/json", ...(out.headers ?? {}) });
    res.end(out.text ?? JSON.stringify(out.json ?? {}));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, bodies, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const settingsFor = (url: string, extra: Partial<AiSettings> = {}): AiSettings => ({
  decision: null,
  feedback: { kind: "openai-chat", url: `${url}/chat`, model: "test-model", timeoutMs: 5000 },
  vision: null,
  autoFeedback: "never",
  language: "English",
  ...extra,
});

const ctx: GradingContext = {
  card: [{ label: "prompt", text: "What does HTTP stand for?" }],
  instructions: [],
  answerText: "hypertext transfer protocol",
  answerImage: null,
};

const decision = (url: string) => ({ kind: "openrouter-decisions" as const, url: `${url}/decisions`, model: "decision-model", timeoutMs: 5000 });

const chatReply = (content: string, model = "chat-model"): Reply => ({
  json: { model, choices: [{ message: { content } }] },
});

const type = { id: "basic", name: "Basic", description: "A prompt and an answer", fields: [{ name: "front", kind: "text" }, { name: "back", kind: "text" }] } as unknown as CardTypeDef;

test("decision model: probabilities choose the verdict and score is normalized", async () => {
  const srv = await stub(() => ({
    json: {
      model: "decision-model",
      usage: { cost: 0.001 },
      answers: { verdict: { type: "score", probabilities: { "0": 0.1, "1": 0.2, "2": 0.7 }, score: 2, confidence: 0.9 } },
    },
  }));
  try {
    const v = await aiVerdict(settingsFor(srv.url, { decision: decision(srv.url) }), ctx);
    assert.equal(v.verdict, "correct");
    assert.equal(v.score, 1);
    assert.equal(v.confidence, 0.9);
    assert.equal(v.model, "decision-model");
    assert.equal(v.cost, 0.001);

    const body = srv.bodies[0];
    assert.equal(body.questions.verdict.type, "score");
    assert.equal(body.questions.verdict.criteria.length, 3);
    assert.match(body.state, /What does HTTP stand for\?/);
    assert.match(body.state, /hypertext transfer protocol/);
  } finally {
    await srv.close();
  }
});

test("decision model: an empty answer grades without a request", async () => {
  const srv = await stub(() => ({ json: {} }));
  try {
    const v = await aiVerdict(settingsFor(srv.url, { decision: decision(srv.url) }), { ...ctx, answerText: "   " });
    assert.equal(v.verdict, "incorrect");
    assert.equal(v.score, 0);
    assert.equal(v.model, "empty-answer");
    assert.equal(srv.bodies.length, 0);
  } finally {
    await srv.close();
  }
});

test("a failed decision model falls back to the language model", async () => {
  const srv = await stub((body) =>
    body.questions ? { status: 500, json: { error: "boom" } } : chatReply('{"verdict":"partial","score":0.5,"feedback":"Half right."}', "fallback-model"),
  );
  try {
    const v = await aiVerdict(settingsFor(srv.url, { decision: decision(srv.url) }), ctx);
    assert.equal(v.verdict, "partial");
    assert.equal(v.score, 0.5);
    assert.equal(v.feedback, "Half right.");
    assert.match(v.model, /^fallback-model \(decision model failed: HTTP 500/);
  } finally {
    await srv.close();
  }
});

test("language-model grading parses JSON and carries the Arabic tolerance policy", async () => {
  const srv = await stub(() => chatReply('{"verdict":"correct","score":1,"feedback":"Right: HyperText Transfer Protocol."}'));
  try {
    const v = await aiVerdict(settingsFor(srv.url), ctx);
    assert.equal(v.verdict, "correct");
    assert.equal(v.score, 1);
    assert.equal(v.feedback, "Right: HyperText Transfer Protocol.");

    const body = srv.bodies[0];
    assert.equal(body.response_format.type, "json_object");
    const system = body.messages[0].content as string;
    assert.match(system, /unvocalized answers/i);
    assert.match(system, /Tashkeel/);
    assert.match(system, /JSON only/);
  } finally {
    await srv.close();
  }
});

test("language-model grading clamps unknown verdicts and scores", async () => {
  const srv = await stub(() => chatReply('{"verdict":"maybe","score":7,"feedback":""}'));
  try {
    const v = await aiVerdict(settingsFor(srv.url), ctx);
    assert.equal(v.verdict, "incorrect");
    assert.equal(v.score, 1);
    assert.equal(v.feedback, undefined);
  } finally {
    await srv.close();
  }
});

test("malformed model output is an AiError", async () => {
  const srv = await stub(() => chatReply("not json at all"));
  try {
    await assert.rejects(aiVerdict(settingsFor(srv.url), ctx), /expected JSON/);
  } finally {
    await srv.close();
  }
});

test("a retry verdict becomes an ungraded hint only when the card allows retries", async () => {
  const srv = await stub(() => chatReply('{"verdict":"retry","hint":"Think about the protocol layer."}'));
  try {
    const v = await aiVerdict(settingsFor(srv.url), { ...ctx, retryWhen: "the answer is unreadable" });
    assert.equal(v.verdict, "ungraded");
    assert.deepEqual(v.retry, { hint: "Think about the protocol layer." });
    assert.match(srv.bodies[0].messages[0].content, /ask the student for another try/);

    const plain = await aiVerdict(settingsFor(srv.url), ctx);
    assert.equal(plain.verdict, "incorrect");
  } finally {
    await srv.close();
  }
});

test("an empty or oversized retry hint is rejected", async () => {
  const srv = await stub(() => chatReply('{"verdict":"retry","hint":"   "}'));
  try {
    await assert.rejects(aiVerdict(settingsFor(srv.url), { ...ctx, retryWhen: "unreadable" }), /invalid retry hint/);
  } finally {
    await srv.close();
  }
});

test("a 429 response is retried once after the advertised delay", async () => {
  let calls = 0;
  const srv = await stub(() => {
    calls += 1;
    if (calls === 1) return { status: 429, json: { error: "rate limited" }, headers: { "retry-after": "1" } };
    return chatReply('{"verdict":"correct","score":1,"feedback":"ok"}');
  });
  try {
    const v = await aiVerdict(settingsFor(srv.url), ctx);
    assert.equal(v.verdict, "correct");
    assert.equal(calls, 2);
  } finally {
    await srv.close();
  }
});

test("vision answers route to the vision provider and require one", async () => {
  const srv = await stub(() => chatReply('{"verdict":"correct","score":1,"feedback":"Drawing is right."}'));
  try {
    const vision = { kind: "openai-chat" as const, url: `${srv.url}/chat`, model: "vision-model", timeoutMs: 5000, vision: true };
    const v = await aiVerdict(settingsFor(srv.url, { vision }), { ...ctx, answerText: null, answerImage: "data:image/png;base64,AAAA" });
    assert.equal(v.verdict, "correct");
    const content = srv.bodies[0].messages[1].content;
    assert.ok(Array.isArray(content));
    assert.equal(content[1].type, "image_url");
    assert.equal(content[1].image_url.url, "data:image/png;base64,AAAA");

    await assert.rejects(aiVerdict(settingsFor(srv.url), { ...ctx, answerText: null, answerImage: "data:image/png;base64,AAAA" }), /no vision model/);
  } finally {
    await srv.close();
  }
});

test("aiFeedback sends the given grade and returns trimmed text", async () => {
  const srv = await stub(() => chatReply("  Feedback text.  ", "feedback-model"));
  try {
    const out = await aiFeedback(settingsFor(srv.url), { ...ctx, verdict: "partial", score: 0.5 });
    assert.equal(out.feedback, "Feedback text.");
    assert.equal(out.model, "feedback-model");
    const body = srv.bodies[0];
    assert.equal(body.response_format, undefined);
    assert.match(body.messages[1].content, /Grade already given/);
    assert.match(body.messages[1].content, /partial \(score 0\.50\)/);
  } finally {
    await srv.close();
  }
});

test("aiEditFields returns field changes and rejects bad replies", async () => {
  const srv = await stub(() => chatReply('{"changes":{"front":"New question"}}'));
  try {
    const out = await aiEditFields(settingsFor(srv.url), type, { front: "Old", back: "Answer" }, "make it shorter");
    assert.deepEqual(out.changes, { front: "New question" });
    assert.match(srv.bodies[0].messages[0].content, /Edit the contents of a practice card/);
  } finally {
    await srv.close();
  }

  const bad = await stub(() => chatReply('{"changes":[]}'));
  try {
    await assert.rejects(aiEditFields(settingsFor(bad.url), type, { front: "Old" }, "x"), /no field changes object/);
  } finally {
    await bad.close();
  }

  const worse = await stub(() => chatReply("nope"));
  try {
    await assert.rejects(aiEditFields(settingsFor(worse.url), type, { front: "Old" }, "x"), /invalid JSON/);
  } finally {
    await worse.close();
  }
});

test("aiGenerateItems normalizes both reply shapes and rejects empty replies", async () => {
  const srv = await stub(() => chatReply('{"items":[{"title":"T","fields":{"front":"Q","back":"A"}}]}'));
  try {
    const out = await aiGenerateItems(settingsFor(srv.url), type, "make one", { count: 1 });
    assert.deepEqual(out.items, [{ fields: { front: "Q", back: "A" }, title: "T" }]);
    assert.match(srv.bodies[0].messages[0].content, /flashcard creator/);
    assert.match(srv.bodies[0].messages[0].content, /generate 1 high-quality/);
  } finally {
    await srv.close();
  }

  const single = await stub(() => chatReply('{"fields":{"front":"Q","back":"A"}}'));
  try {
    const out = await aiGenerateItems(settingsFor(single.url), type, "make one");
    assert.deepEqual(out.items, [{ fields: { front: "Q", back: "A" }, title: undefined }]);
  } finally {
    await single.close();
  }

  const empty = await stub(() => chatReply("{}"));
  try {
    await assert.rejects(aiGenerateItems(settingsFor(empty.url), type, "make one"), /no cards/);
  } finally {
    await empty.close();
  }
});

test("no configured grader is a clear error", async () => {
  await assert.rejects(aiVerdict({ ...settingsFor("http://127.0.0.1:9"), decision: null, feedback: null }, ctx), /no AI grader configured/);
  await assert.rejects(aiFeedback({ ...settingsFor("http://127.0.0.1:9"), feedback: null }, ctx), /no feedback model configured/);
});
