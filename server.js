require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { parseQuery } = require('./parser');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: '*' }));
app.use(express.json());

/** Age bands aligned with seed data: senior 60+, adult 18–59, teenager 13–17, child ≤12 */
const AGE_GROUP_FROM_AGE_SQL =
    "CASE WHEN age <= 12 THEN 'child' WHEN age BETWEEN 13 AND 17 THEN 'teenager' WHEN age BETWEEN 18 AND 59 THEN 'adult' ELSE 'senior' END";

const fetchProfiles = async (filters, reqQuery) => {
    const page = Math.max(1, parseInt(reqQuery.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(reqQuery.limit, 10) || 10));
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
        gender:                 'gender =',
        country_id:             'country_id =',
        min_age:                'age >=',
        max_age:                'age <=',
        min_gender_probability: 'gender_probability >=',
        min_country_probability:'country_probability >='
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
        }
        whereClauses.push(`${op} $${paramIndex++}`);
        values.push(v);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const allowedSort = ['age', 'gender_probability', 'country_probability', 'created_at'];
    const sortField = allowedSort.includes(reqQuery.sort_by) ? reqQuery.sort_by : 'created_at';
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

    const total = parseInt(countRes.rows[0].count, 10);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
        status: "success",
        page,
        current_page: page,
        limit,
        total,
        total_pages: totalPages,
        pagination: {
            current_page: page,
            limit,
            per_page: limit,
            total,
            total_pages: totalPages
        },
        data: dataRes.rows
    };
};

// ENDPOINT 1: Standard Filtering
app.get('/api/profiles', async (req, res) => {
    try {
        // Validate sort_by if provided
        const allowedSort = ['age', 'gender_probability', 'country_probability', 'created_at'];
        if (req.query.sort_by && !allowedSort.includes(req.query.sort_by)) {
            return res.status(422).json({ status: "error", message: "Invalid query parameters" });
        }
        if (req.query.order && !['asc', 'desc'].includes(req.query.order.toLowerCase())) {
            return res.status(422).json({ status: "error", message: "Invalid query parameters" });
        }
        if (req.query.gender && !['male', 'female'].includes(req.query.gender)) {
            return res.status(422).json({ status: "error", message: "Invalid query parameters" });
        }
        const validAgeGroups = ['child', 'teenager', 'adult', 'senior'];
        if (req.query.age_group && !validAgeGroups.includes(req.query.age_group)) {
            return res.status(422).json({ status: "error", message: "Invalid query parameters" });
        }

        const result = await fetchProfiles(req.query, req.query);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// ENDPOINT 2: Natural Language Search
app.get('/api/profiles/search', async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) {
        return res.status(400).json({ status: "error", message: "Missing or empty parameter: q" });
    }

    const filters = parseQuery(q.trim());

    if (!filters || Object.keys(filters).length === 0) {
        return res.status(422).json({ status: "error", message: "Unable to interpret query" });
    }

    try {
        const result = await fetchProfiles(filters, req.query);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Insighta Engine live on port ${PORT}`));