from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional
import asyncpg
from app.database import get_pool
from app.nlp_parser import parse_query

router = APIRouter()

VALID_SORT_FIELDS = {"age", "created_at", "gender_probability"}
VALID_ORDERS = {"asc", "desc"}
VALID_AGE_GROUPS = {"child", "teenager", "adult", "senior"}
VALID_GENDERS = {"male", "female"}


def format_record(r: asyncpg.Record) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "gender": r["gender"],
        "gender_probability": r["gender_probability"],
        "age": r["age"],
        "age_group": r["age_group"],
        "country_id": r["country_id"],
        "country_name": r["country_name"],
        "country_probability": r["country_probability"],
        "created_at": r["created_at"].strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


async def build_filtered_query(
    gender: Optional[str] = None,
    age_group: Optional[str] = None,
    country_id: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    min_gender_probability: Optional[float] = None,
    min_country_probability: Optional[float] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    page: int = 1,
    limit: int = 10,
):
    # Validate enum-like params
    if gender and gender not in VALID_GENDERS:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    if age_group and age_group not in VALID_AGE_GROUPS:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    if sort_by not in VALID_SORT_FIELDS:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    if order not in VALID_ORDERS:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    if limit > 50:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    if page < 1 or limit < 1:
        raise HTTPException(status_code=422, detail="Invalid query parameters")

    conditions = []
    params = []
    idx = 1

    if gender:
        conditions.append(f"gender = ${idx}")
        params.append(gender)
        idx += 1

    if age_group:
        conditions.append(f"age_group = ${idx}")
        params.append(age_group)
        idx += 1

    if country_id:
        conditions.append(f"country_id = ${idx}")
        params.append(country_id.upper())
        idx += 1

    if min_age is not None:
        conditions.append(f"age >= ${idx}")
        params.append(min_age)
        idx += 1

    if max_age is not None:
        conditions.append(f"age <= ${idx}")
        params.append(max_age)
        idx += 1

    if min_gender_probability is not None:
        conditions.append(f"gender_probability >= ${idx}")
        params.append(min_gender_probability)
        idx += 1

    if min_country_probability is not None:
        conditions.append(f"country_probability >= ${idx}")
        params.append(min_country_probability)
        idx += 1

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    order_clause = f"ORDER BY {sort_by} {order.upper()}"
    offset = (page - 1) * limit

    data_sql = f"""
        SELECT * FROM profiles
        {where_clause}
        {order_clause}
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    count_sql = f"SELECT COUNT(*) FROM profiles {where_clause}"

    return data_sql, count_sql, params + [limit, offset], params


@router.get("/profiles")
async def get_profiles(
    gender: Optional[str] = Query(None),
    age_group: Optional[str] = Query(None),
    country_id: Optional[str] = Query(None),
    min_age: Optional[int] = Query(None),
    max_age: Optional[int] = Query(None),
    min_gender_probability: Optional[float] = Query(None),
    min_country_probability: Optional[float] = Query(None),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    page: int = Query(1),
    limit: int = Query(10),
):
    data_sql, count_sql, data_params, count_params = await build_filtered_query(
        gender, age_group, country_id, min_age, max_age,
        min_gender_probability, min_country_probability,
        sort_by, order, page, limit,
    )

    pool = await get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval(count_sql, *count_params)
        rows = await conn.fetch(data_sql, *data_params)

    return {
        "status": "success",
        "page": page,
        "limit": limit,
        "total": total,
        "data": [format_record(r) for r in rows],
    }


@router.get("/profiles/search")
async def search_profiles(
    q: Optional[str] = Query(None),
    page: int = Query(1),
    limit: int = Query(10),
):
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Missing or empty parameter")

    if limit > 50:
        raise HTTPException(status_code=422, detail="Invalid query parameters")
    if page < 1 or limit < 1:
        raise HTTPException(status_code=422, detail="Invalid query parameters")

    parsed = parse_query(q)
    if parsed is None:
        return {"status": "error", "message": "Unable to interpret query"}

    data_sql, count_sql, data_params, count_params = await build_filtered_query(
        gender=parsed.gender,
        age_group=parsed.age_group,
        country_id=parsed.country_id,
        min_age=parsed.min_age,
        max_age=parsed.max_age,
        sort_by="created_at",
        order="desc",
        page=page,
        limit=limit,
    )

    pool = await get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval(count_sql, *count_params)
        rows = await conn.fetch(data_sql, *data_params)

    return {
        "status": "success",
        "page": page,
        "limit": limit,
        "total": total,
        "data": [format_record(r) for r in rows],
    }
