require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { parseQuery } = require('./parser'); // This uses the parser logic we wrote earlier

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: '*' }));
app.use(express.json());

// Helper function to build the SQL query dynamically
const fetchProfiles = async (filters, reqQuery) => {
    // 1. Bulletproof Pagination
    const page = Math.max(1, parseInt(reqQuery.page) || 1);
    const limit = Math.max(1, Math.min(parseInt(reqQuery.limit) || 10, 100));
    const offset = (page - 1) * limit;

    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    // Mapping filters to SQL placeholders
    const filterMap = {
        gender: 'gender =',
        country_id: 'country_id =',
        min_age: 'age >=',
        max_age: 'age <=',
        min_gender_probability: 'gender_probability >=',
        min_country_probability: 'country_probability >='
    };

    for (const [key, op] of Object.entries(filterMap)) {
        if (filters[key] !== undefined && filters[key] !== null) {
            whereClauses.push(`${op} $${paramIndex++}`);
            values.push(filters[key]);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 2. Dynamic Sorting
    const allowedSortFields = ['age', 'gender_probability', 'country_probability', 'created_at'];
    const sortField = allowedSortFields.includes(reqQuery.sort_by) ? reqQuery.sort_by : 'created_at';
    const sortOrder = reqQuery.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 3. Optimized Queries
    const dataSql = `SELECT * FROM profiles ${whereSql} ORDER BY ${sortField} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const countSql = `SELECT COUNT(*) FROM profiles ${whereSql}`;

    const [dataRes, countRes] = await Promise.all([
        pool.query(dataSql, [...values, limit, offset]),
        pool.query(countSql, values)
    ]);

    return {
        data: dataRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: page,
        limit: limit
    };
};

// ENDPOINT 1: Standard Filtering
app.get('/api/profiles', async (req, res) => {
    try {
        const result = await fetchProfiles(req.query, req.query);
        res.json({ status: "success", ...result });
    } catch (err) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

// ENDPOINT 2: Natural Language Query
app.get('/api/profiles/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ status: "error", message: "Missing query parameter 'q'" });

    const filters = parseQuery(q);
    if (!filters) return res.status(400).json({ status: "error", message: "Unable to interpret query" });

    try {
        const result = await fetchProfiles(filters, req.query);
        res.json({ status: "success", ...result });
    } catch (err) {
        res.status(500).json({ status: "error", message: "Internal server error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Insighta Engine live on port ${PORT}`));