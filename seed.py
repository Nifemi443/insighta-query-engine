"""
Seed script — run manually or on startup.
Usage: python -m app.seed profiles.json

Idempotent: uses INSERT ... ON CONFLICT (name) DO NOTHING
so re-running never creates duplicates.
"""

import asyncio
import json
import sys
import os
from dotenv import load_dotenv
from uuid_extensions import uuid7str
import asyncpg

load_dotenv()


def determine_age_group(age: int) -> str:
    if age < 13:
        return "child"
    elif age < 18:
        return "teenager"
    elif age < 65:
        return "adult"
    else:
        return "senior"


async def seed(filepath: str):
    with open(filepath, "r") as f:
        profiles = json.load(f)

    print(f"Loaded {len(profiles)} profiles from {filepath}")

    pool = await asyncpg.create_pool(
        dsn=os.getenv("DATABASE_URL"),
        min_size=2,
        max_size=10,
        statement_cache_size=0,
    )

    INSERT_SQL = """
        INSERT INTO profiles (
            id, name, gender, gender_probability,
            age, age_group, country_id, country_name,
            country_probability, created_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            NOW()
        )
        ON CONFLICT (name) DO NOTHING
    """

    inserted = 0
    skipped = 0

    async with pool.acquire() as conn:
        for p in profiles:
            age = int(p.get("age", 0))
            age_group = p.get("age_group") or determine_age_group(age)

            result = await conn.execute(
                INSERT_SQL,
                uuid7str(),
                p["name"],
                p["gender"],
                float(p["gender_probability"]),
                age,
                age_group,
                p["country_id"],
                p["country_name"],
                float(p["country_probability"]),
            )
            # result is e.g. "INSERT 0 1" or "INSERT 0 0"
            if result.endswith("1"):
                inserted += 1
            else:
                skipped += 1

    await pool.close()
    print(f"Done. Inserted: {inserted} | Skipped (duplicates): {skipped}")


if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "profiles.json"
    asyncio.run(seed(filepath))
