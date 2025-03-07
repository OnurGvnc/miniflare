import { beforeAll, expect, test } from "vitest";
setupMiniflareIsolatedStorage();

beforeAll(async () => {
  const { TEST_OBJECT } = getMiniflareBindings();
  const id = TEST_OBJECT.idFromName("test");
  const storage = await getMiniflareDurableObjectStorage(id);
  await storage.put("test", "value");
});

test("Durable Objects", async () => {
  const { TEST_OBJECT } = getMiniflareBindings();
  const id = TEST_OBJECT.idFromName("test");
  const stub = TEST_OBJECT.get(id);
  const res = await stub.fetch("https://object/");
  expect(await res.text()).toBe("durable:https://object/:value");
});

test("Durable Objects direct", async () => {
  class Counter {
    constructor(state) {
      this.storage = state.storage;
    }
    async fetch() {
      const count = (await this.storage.get("count")) ?? 0;
      void this.storage.put("count", count + 1);
      return new Response(String(count));
    }
  }

  // https://github.com/cloudflare/miniflare/issues/157
  const env = getMiniflareBindings();
  // Doesn't matter too much that we're using a different object binding here
  const id = env.TEST_OBJECT.idFromName("test");
  const state = await getMiniflareDurableObjectState(id);
  const object = new Counter(state, env);
  const [res1, res2] = await Promise.all([
    runWithMiniflareDurableObjectGates(state, () =>
      object.fetch(new Request("https://object/"))
    ),
    runWithMiniflareDurableObjectGates(state, () =>
      object.fetch(new Request("https://object/"))
    ),
  ]);
  expect(await state.storage.get("count")).toBe(2);
  expect(await res1.text()).toBe("0");
  expect(await res2.text()).toBe("1");
});
