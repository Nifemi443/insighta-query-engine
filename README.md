# Insighta Labs: Intelligence Query Engine

Backend Stage 2 assessment API for **Insighta Labs**. Clients filter, sort, paginate, and search demographic profiles via query parameters or a **rule-based** natural-language endpoint (no LLMs).

---

## Endpoints

### `GET /api/profiles`

Filtering, sorting, and pagination in one request.

**Filters (combinable with AND semantics):**

| Parameter | Description |
|-----------|-------------|
| `gender` | `male` or `female` |
| `age_group` | `child`, `teenager`, `adult`, `senior` |
| `country_id` | ISO 3166-1 alpha-2 (e.g. `NG`, `KE`) |
| `min_age` | Minimum age (inclusive) |
| `max_age` | Maximum age (inclusive) |
| `min_gender_probability` | Minimum gender confidence (0–1) |
| `min_country_probability` | Minimum country confidence (0–1) |

**Sorting:** `sort_by` → `age` \| `created_at` \| `gender_probability` only.  
**Order:** `order` → `asc` \| `desc` (default `desc`).

**Pagination:** `page` (default `1`), `limit` (default `10`, max `50`).

**Success (200)** — response shape must match exactly:

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "data": [
    {
      "id": "…",
      "name": "emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-01T12:00:00Z"
    }
  ]
}
```

`total`, `page`, and `limit` are always JSON numbers. Timestamps are **UTC ISO 8601**. Profile `id` values are **UUID v7**.

**Errors:** `{ "status": "error", "message": "…" }` — invalid filter/sort/pagination → **422** `Invalid query parameters`; server errors → **500** `Server failure`.

---

### `GET /api/profiles/search`

**Query:** `q` (required) — plain English. Optional `page`, `limit`, and the same `sort_by` / `order` as above.

If the query cannot be mapped to any filter, response is **422** with  
`{ "status": "error", "message": "Unable to interpret query" }`.

If `q` is missing or empty → **400** `Missing or empty parameter: q`.

---

## Natural language parsing (`parser.js`)

Approach: **deterministic, rule-based** pipeline (no AI).

1. **Normalize** — input is lowercased for matching.
2. **Gender** — word-boundary regex on keywords such as `male` / `males` / `men` / `man` / `boy(s)` → `gender: male`, and the female set → `gender: female`. If **both** male and female cues appear (e.g. *male and female teenagers*), **no** gender filter is applied.
3. **Age group** — `child` / `children` / `kid(s)` → `age_group: child`; `teenager(s)` / `teen(s)` → `teenager`; `adult(s)` → `adult`; `senior(s)` → `senior`.
4. **“young”** — if no age_group was set from step 3, **`young`** sets `min_age: 16` and `max_age: 24` (parsing only; not a stored `age_group`).
5. **Numeric age phrases** — `aged` / `age` + number → exact age (min and max both set); `above` / `over` / `older than` / `greater than` + number → `min_age`; `under` / `below` / `younger than` / `less than` + number → `max_age`; `between X and Y` → `min_age` / `max_age`. Later patterns override earlier ones where they conflict.
6. **Country** — longest multi-word names first (e.g. `south africa`), then single tokens; demonyms and country names map to **ISO-2** `country_id`.

### Example mappings (from the task brief)

| Query | Filters |
|--------|---------|
| young males | `gender=male`, `min_age=16`, `max_age=24` |
| females above 30 | `gender=female`, `min_age=30` |
| people from angola | `country_id=AO` |
| adult males from kenya | `gender=male`, `age_group=adult`, `country_id=KE` |
| male and female teenagers above 17 | `age_group=teenager`, `min_age=17` (no gender filter) |

---

## Limitations and edge cases

- **No OR / NOT / negation** — everything is AND-only; e.g. “Nigeria or Kenya” is not supported as a disjunction.
- **“young” + explicit age group** — if an age_group keyword is detected first (e.g. *young adults*), **“young”** is skipped, so the 16–24 range may not apply; the age_group filter dominates.
- **Conflicting age rules** — overlapping `min_age` / `max_age` / `between` / `aged` / `above` / `below` resolve by **rule order** in code, not natural-language precedence.
- **Countries** — only countries (and demonyms) in the parser dictionary produce a `country_id`; anything else yields no country filter (and may leave the query with no filters at all → unable to interpret).
- **Typos and synonyms** — not fuzzy; unlisted synonyms (e.g. “blokes”, “elders”) are ignored unless added to the rules.
- **No boolean logic** — compound conditions in English beyond what the rules encode are not parsed.

---

## Performance

PostgreSQL indexes on filter and sort columns (`gender`, `age_group`, `country_id`, `age`, `gender_probability`, `country_probability`, `created_at`) keep list queries index-friendly and avoid unnecessary full-table scans where possible.

---

## Tech stack

- Node.js, Express  
- PostgreSQL  
- UUID v7 for `id`  
- CORS: `Access-Control-Allow-Origin: *`

---

## Setup

```bash
npm install
```

Create `.env` with `DATABASE_URL`.

**Seed** (2026 profiles from `seed_profiles.json`; safe to re-run — duplicates skipped by `ON CONFLICT (name)`):

```bash
node seed.js
```

**Run:**

```bash
node server.js
```

Ensure the `profiles` table matches the assessment schema (`id` UUID v7 PK, `name` UNIQUE, etc.) before seeding.
