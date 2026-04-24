require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { parseQuery } = require('./parser');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: '*' }));
app.use(express.json());

/** Spec: sort_by → age | created_at | gender_probability only */
const ALLOWED_SORT = ['age', 'created_at', 'gender_probability'];
const ALLOWED_ORDER = ['asc', 'desc'];
const ALLOWED_GENDER = ['male', 'female'];
const ALLOWED_AGE_GROUP = ['child', 'teenager', 'adult', 'senior'];

/** Age bands for rows with NULL age_group (should not occur after proper seed) */
const AGE_GROUP_FROM_AGE_SQL =
    "CASE WHEN age <= 12 THEN 'child' WHEN age BETWEEN 13 AND 17 THEN 'teenager' WHEN age BETWEEN 18 AND 59 THEN 'adult' ELSE 'senior' END";

const intOr = (val, fallback) => {
    const n = parseInt(String(val), 10);
    return Number.isFinite(n) ? n : fallback;
};

const buildProfilesJsonBody = (page, limit, total, rows) => ({
    status: 'success',
    page: intOr(page, 1),
    limit: intOr(limit, 10),
    total: intOr(total, 0),
    data: rows.map(serializeProfileRow)
});

function serializeProfileRow(row) {
    return {
        id: row.id,
        name: row.name,
        gender: row.gender,
        gender_probability: row.gender_probability == null ? null : Number(row.gender_probability),
        age: row.age == null ? null : intOr(row.age, 0),
        age_group: row.age_group,
        country_id: row.country_id,
        country_name: row.country_name,
        country_probability: row.country_probability == null ? null : Number(row.country_probability),
        created_at: row.created_at
    };
}

/**
 * Validates GET /api/profiles and GET /api/profiles/search list query params per task spec.
 * @param {object} query - req.query
 * @param {{ forSearch?: boolean }} opts - if forSearch, only validates pagination + sort (not filter fields)
 */
function validateListQuery(query, opts = {}) {
    const { forSearch } = opts;

    if (!forSearch) {
        if (query.sort_by && !ALLOWED_SORT.includes(query.sort_by)) return false;
        if (query.gender && !ALLOWED_GENDER.includes(query.gender)) return false;
        if (query.age_group && !ALLOWED_AGE_GROUP.includes(query.age_group)) return false;

        const numericFilters = ['min_age', 'max_age', 'min_gender_probability', 'min_country_probability'];
        for (const k of numericFilters) {
            if (query[k] !== undefined && query[k] !== '' && Number.isNaN(Number(query[k]))) return false;
        }

        if (query.country_id !== undefined && query.country_id !== '') {
            const cid = String(query.country_id).trim();
            if (!/^[A-Za-z]{2}$/.test(cid)) return false;
        }
    } else {
        if (query.sort_by && !ALLOWED_SORT.includes(query.sort_by)) return false;
    }

    if (query.order && !ALLOWED_ORDER.includes(String(query.order).toLowerCase())) return false;

    if (query.page !== undefined && query.page !== '') {
        const p = intOr(query.page, NaN);
        if (!Number.isFinite(p) || p < 1) return false;
    }
    if (query.limit !== undefined && query.limit !== '') {
        const l = intOr(query.limit, NaN);
        if (!Number.isFinite(l) || l < 1 || l > 50) return false;
    }

    return true;
}

const fetchProfiles = async (filters, reqQuery) => {
    const page = Math.max(1, intOr(reqQuery.page, 1));
    const limit = Math.min(50, Math.max(1, intOr(reqQuery.limit, 10)));
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    const f = { ...filters };
    if ((f.country_id === undefined || f.country_id === null || f.country_id === '') && f.country) {
        f.country_id = f.country;
    }

    const ageGroupVal = f.age_group !== undefined && f.age_group !== null && f.age_group !== '' ? f.age_group : null;
    if (ageGroupVal) {
        whereClauses.push(`(age_group = $${paramIndex} OR (age_group IS NULL AND (${AGE_GROUP_FROM_AGE_SQL}) = $${paramIndex + 1}))`);
        values.push(ageGroupVal, ageGroupVal);
        paramIndex += 2;
    }

    const filterMap = {
        gender: 'gender =',
        country_id: 'country_id =',
        min_age: 'age >=',
        max_age: 'age <=',
        min_gender_probability: 'gender_probability >=',
        min_country_probability: 'country_probability >='
    };

    for (const [key, op] of Object.entries(filterMap)) {
        if (f[key] === undefined || f[key] === null || f[key] === '') continue;
        let v = f[key];
        if (key === 'min_age' || key === 'max_age') {
            v = parseInt(v, 10);
            if (Number.isNaN(v)) continue;
        } else if (key === 'min_gender_probability' || key === 'min_country_probability') {
            v = parseFloat(v);
            if (Number.isNaN(v)) continue;
        } else if (key === 'country_id') {
            v = String(v).toUpperCase();
        } else if (key === 'gender') {
            v = String(v).toLowerCase();
        }
        whereClauses.push(`${op} $${paramIndex++}`);
        values.push(v);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sortField = ALLOWED_SORT.includes(reqQuery.sort_by) ? reqQuery.sort_by : 'created_at';
    const sortOrder = reqQuery.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const dataSql = `
        SELECT id, name, gender, gender_probability, age, age_group,
               country_id, country_name, country_probability,
               to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
        FROM profiles ${whereSql}
        ORDER BY ${sortField} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const countSql = `SELECT COUNT(*) FROM profiles ${whereSql}`;

    const [dataRes, countRes] = await Promise.all([
        pool.query(dataSql, [...values, limit, offset]),
        pool.query(countSql, values)
    ]);

    const total = intOr(countRes.rows[0].count, 0);

    return buildProfilesJsonBody(page, limit, total, dataRes.rows);
};

app.get('/api/profiles', async (req, res) => {
    try {
        if (!validateListQuery(req.query, { forSearch: false })) {
            return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
        }

        const body = await fetchProfiles(req.query, req.query);
        return res.status(200).json(body);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', message: 'Server failure' });
    }
});

app.get('/api/profiles/search', async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) {
        return res.status(400).json({ status: 'error', message: 'Missing or empty parameter: q' });
    }

    if (!validateListQuery(req.query, { forSearch: true })) {
        return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }

    const filters = parseQuery(q.trim());

    if (!filters || Object.keys(filters).length === 0) {
        return res.status(422).json({ status: 'error', message: 'Unable to interpret query' });
    }

    try {
        const body = await fetchProfiles(filters, req.query);
        return res.status(200).json(body);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', message: 'Server failure' });
    }
});

app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Insighta Engine live on port ${PORT}`));
