require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { parseQuery } = require('./parser');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: '*' }));
app.use(express.json());

const fetchProfiles = async (filters, reqQuery) => {
    const page = Math.max(1, parseInt(reqQuery.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(reqQuery.limit) || 10));
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    // FIX 1: Added age_group to filterMap
    const filterMap = {
        gender:                 'gender =',
        age_group:              'age_group =',
        country_id:             'country_id =',
        min_age:                'age >=',
        max_age:                'age <=',
        min_gender_probability: 'gender_probability >=',
        min_country_probability:'country_probability >='
    };

    for (const [key, op] of Object.entries(filterMap)) {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
            whereClauses.push(`${op} $${paramIndex++}`);
            values.push(filters[key]);
        }
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

    const total = parseInt(countRes.rows[0].count);

    // FIX 2: Flat response structure matching spec exactly
    return {
        status: "success",
        page,
        limit,
        total,
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