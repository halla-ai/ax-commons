# Aggregate storage and wire schema

- Wire schema: `packages/receiver/schema.json`. Runtime validation additionally rejects duplicate cell keys within a snapshot and enforces monthly acceptance windows.
- Program IDs: 32-64 lowercase hex characters generated randomly, never derived from personal data. Device/source IDs are prohibited in the wire payload. Private source keys are SHA-256 hex digests of random per-device authorization credentials, derived only on the server.
- Period: UTC `YYYY-MM`, year 2000-2099. Task types: `document-summary`, `translation`, `writing`, `coding`, `data`, `other`.
- Review and reuse are booleans. Skill IDs are the approved relative paths under `commons/skills`, or null when no known skill was used. New skill IDs require a reviewed registry update.
- Cells: at most 192 unique disjoint combinations, count integer 5-1,000,000. Contribution count: integer 0 or 5-1,000,000, retained privately and not published as a complementary total.

## Persistent tables

```sql
CREATE TABLE snapshots (
  program_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  period TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY (program_id, source_id, period)
);
CREATE TABLE releases (
  period TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
```

- `snapshots.payload`: validated aggregate snapshot JSON only. Replacement is atomic on the composite primary key. No content, access tokens, IP addresses or user-account mapping columns exist.
- `releases.payload`: frozen suppressed public JSON, with no private source keys or contribution totals. Insert-if-absent only.
- Credentials are runtime secrets outside the database and repository. Host access logs and error handling must avoid request bodies and credentials.
- Backups need the same access restriction and retention controls as active snapshots. Authenticated source revocation removes the active snapshot; backup retention must be disclosed by the operator.
- Immutable public monthly releases prevent repeated publication and deletion differencing. They are aggregate counts, with the limits described in `docs/api.md`.

## Recognition

- The dashboard displays approved skill IDs in the existing disjoint activity cells. Rows marked `reused:true` provide the reuse recognition evidence.
- Do not add contributor names inferred from pseudonyms, combined totals, filtered period sums or rankings that disclose suppressed cells.
- The operator decides any material reward outside this schema.

## Private GitHub storage adapter

- Logical records use `snapshots/<program>/<private-source>/<month>.json`, `releases/<month>.json`, and `usage/<month>.json` in the verified private repository. Each snapshot is the validated wire fields plus the server-derived source key.
- `consents/<random-hex>.json` is a separate restricted namespace for the approved contribution workflow. Generic adapter paths are allowlisted; arbitrary paths and traversal are rejected.
- GitHub contents SHA supplies optimistic compare-and-swap. Snapshot mutation retries conflicts at most four times; release creation never overwrites an existing file. Truncated tree listings fail closed.
- Deleting a current snapshot does not purge historical Git commits. Disclose the operator's private history and backup retention; see `docs/deployment.md`.
