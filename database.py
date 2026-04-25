import os
import asyncpg
from dotenv import load_dotenv

load_dotenv()

_pool = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.getenv("DATABASE_URL"),
            min_size=2,
            max_size=10,
            statement_cache_size=0,  # required for Railway PgBouncer compatibility
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


CREATE_TABLE_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
    id            VARCHAR(36)   PRIMARY KEY,
    name          VARCHAR(255)  NOT NULL UNIQUE,
    gender        VARCHAR(10)   NOT NULL,
    gender_probability FLOAT    NOT NULL,
    age           INT           NOT NULL,
    age_group     VARCHAR(20)   NOT NULL,
    country_id    VARCHAR(2)    NOT NULL,
    country_name  VARCHAR(100)  NOT NULL,
    country_probability FLOAT   NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_gender      ON profiles(gender);
CREATE INDEX IF NOT EXISTS idx_profiles_age_group   ON profiles(age_group);
CREATE INDEX IF NOT EXISTS idx_profiles_country_id  ON profiles(country_id);
CREATE INDEX IF NOT EXISTS idx_profiles_age         ON profiles(age);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at  ON profiles(created_at);
"""


async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(CREATE_TABLE_SQL)
