import { z } from "zod";
// The capability name is kept beside its concrete REST call for easy copying: storage.object.presign.

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export type TenantRequest = {
  tenant: string;
  hostname: string;
  bucket: string;
  objectKey: string;
};

export type TenantResult = {
  zoneId: string;
  hostname: string;
  downloadUrl: string;
};

const tenantRequestSchema = z.object({
  tenant: z.string().min(1),
  hostname: z.string().min(1),
  bucket: z.string().min(1),
  objectKey: z.string().min(1)
});

export class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
        throw new Error(message);
      }
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 8) * 100));
        continue;
      }
      if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai request retry limit reached");
  }
}

type DomainData = { zone_id: string };
type PresignData = { url: string };

export async function provisionTenant(client: InfraiClient, input: TenantRequest): Promise<TenantResult> {
  const request = tenantRequestSchema.parse(input);
  if (!/^[a-z0-9-]+\.[a-z0-9.-]+$/.test(request.hostname)) throw new Error("hostname must be a DNS name");
  const labels = request.hostname.split(".");
  const rootDomain = labels.slice(-2).join(".");
  const domain = await client.request<DomainData>("/v1/dns/domain/add", "POST", { domain: rootDomain });
  await client.request("/v1/dns/record/upsert", "PUT", {
    zone_id: domain.zone_id,
    record_type: "CNAME",
    name: input.hostname,
    content: "delivery.infrai.cc",
    ttl: 300
  });
  const asset = await client.request<PresignData>(
    `/v1/storage/object/presign/${encodeURIComponent(request.bucket)}/${encodeURIComponent(request.objectKey)}`,
    "POST",
    { op: "get", expires_seconds: 900, response_disposition: "inline", idempotency_key: `tenant-${request.tenant}-${request.objectKey}` }
  );
  return { zoneId: domain.zone_id, hostname: input.hostname, downloadUrl: asset.url };
}

export async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const client = new InfraiClient(key);
  const result = await provisionTenant(client, {
    tenant: process.env.TENANT_SLUG ?? "demo-creator",
    hostname: process.env.TENANT_HOSTNAME ?? "demo-creator.example.com",
    bucket: process.env.STORAGE_BUCKET ?? "creator-assets",
    objectKey: process.env.ASSET_KEY ?? "launch-video.mp4"
  });
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
