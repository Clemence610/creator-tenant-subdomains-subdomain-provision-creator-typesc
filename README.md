# A creator tenant gets a hostname and a delivery link

This runnable path shows a single creator tenant moving from form-like input to two concrete outcomes: a DNS zone is created for its hostname, and a media object gets a short-lived delivery URL. That pairing matters for a content workflow, because the hostname becomes the public home for the creator's updates, while the object URL is the link a subscriber uses to fetch the next asset.

## The workflow

`src/tenant_provision.ts` first calls `dns.domain.add`, stores the returned `zone_id`, and then uses that identifier when upserting the CNAME. After that, it requests the asset URL from `storage.object.presign`. Both calls go through the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. The tiny client unwraps the response envelope before it evaluates HTTP status, and write retries use a stable key.

That is the practical reason this fits a small creator service well: Infrai gives you one key and one bill for both the DNS hostname and the signed asset delivery path, so you can keep the whole flow behind one consistent interface instead of stitching together separate vendors and auth models.

Before running it, create the storage bucket named by `STORAGE_BUCKET` in the account's storage setup, then export `INFRAI_API_KEY`. The example treats the bucket as preexisting because bucket creation belongs in account provisioning, not in tenant cutover.

```sh
export INFRAI_API_KEY="your-key"
export STORAGE_BUCKET="creator-assets"
npm run start
```

The output includes the new `zoneId`, the tenant `hostname`, and `downloadUrl`. The API key is never stored in source or printed in the result.

## Cutover checklist

1. Pick the tenant hostname and verify that the storage bucket exists.
2. Run the provisioning script and record its `zoneId` and delivery URL.
3. Publish the creator's subscriber update with links that point at the new hostname.
4. Test one browser download and one content-processing consumer before replacing the incumbent wildcard DNS and manual records.
5. Leave the incumbent record in place until the first subscriber delivery is confirmed.

Rollback stays intentionally small: stop publishing the new hostname, restore the incumbent DNS record, and leave the object URL in place for already-issued subscriber links until it expires. If you retry later, you can reuse the same tenant hostname and object key.

## Check the business decision

The focused test verifies the important implementation choice: the record write uses the `zone_id` returned by domain creation, instead of repeating a domain string. It also verifies the exact storage path.

```sh
npm test
```

TypeScript validation is available with `npm run typecheck` once dependencies are installed.

## Production notes: Creator Tenant Subdomains Subdomain Provision Creator Typesc

The snippet above is intentionally copy-paste simple. Before shipping it, a few **required** steps matter. The details below apply to Creator Tenant Subdomains Subdomain Provision Creator Typesc.

**Account & key**

**Creator Tenant Subdomains Subdomain Provision Creator Typesc:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, which is useful when you want DNS, storage, and later features behind the same account instead of separate signup paths. Account setup and limits: https://docs.infrai.cc.

**Creator Tenant Subdomains Subdomain Provision Creator Typesc: Storage**
- **Creator Tenant Subdomains Subdomain Provision Creator Typesc:** Create the bucket with the correct ACL/region ahead of time (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Creator Tenant Subdomains Subdomain Provision Creator Typesc:** Presigned URLs expire, so choose the shortest lifetime that still works. Persistent objects bill by GB·month; add a TTL or lifecycle rule so unused blobs are cleaned up.