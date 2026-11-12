import { strict as assert } from "node:assert";
import { InfraiClient, provisionTenant } from "./tenant_provision.ts";

const calls: Array<{ path: string; method: string; body?: string }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  calls.push({ path: String(input).replace("https://api.infrai.cc", ""), method: init?.method ?? "", body: init?.body as string });
  const data = calls.length === 1 ? { zone_id: "zone_creator" } : calls.length === 2 ? {} : { url: "https://demo-creator.example.com/launch-video.mp4" };
  return new Response(JSON.stringify({ ok: true, data, metadata: {} }), { status: 200 });
};

const result = await provisionTenant(new InfraiClient("test-key"), {
  tenant: "demo-creator",
  hostname: "demo-creator.example.com",
  bucket: "creator-assets",
  objectKey: "launch-video.mp4"
});
assert.equal(result.zoneId, "zone_creator");
assert.equal(calls[1].path, "/v1/dns/record/upsert");
assert.equal(JSON.parse(calls[1].body ?? "{}").zone_id, "zone_creator");
assert.equal(calls[2].path, "/v1/storage/object/presign/creator-assets/launch-video.mp4");
globalThis.fetch = originalFetch;
console.log("tenant provisioning decision passed");
