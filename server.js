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
    let { page = 1, limit = 10, sort_by = 'created_at', order = 'desc' } = reqQuery;
    
    let whereClauses = [];
    let values = [];
    let paramIndex = 1;

    // Mapping filters to SQL
    const filterMap = {
        gender: 'gender =',
        age_group: 'age_group =',
        country_id: 'country_id =',
        min_age: 'age >=',
        max_age: 'age <=',
        min_gender_probability: 'gender_probability >=',
        min_country_probability: 'country_probability >='
    };

    for (const [key, op] of Object.entries(filterMap)) {
        if (filters[key]) {
            whereClauses.push(`${op} $${paramIndex++}`);
            values.push(filters[key]);
        }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    
    // Pagination logic
    const safeLimit = Math.min(parseInt(limit), 50);
    const offset = (parseInt(page) - 1) * safeLimit;

    // Safety check for sorting
    const allowedSort = ['age', 'created_at', 'gender_probability'];
    const finalSort = allowedSort.includes(sort_by) ? sort_by : 'created_at';
    const finalOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const dataQuery = `SELECT * FROM profiles ${whereSql} ORDER BY ${finalSort} ${finalOrder} LIMIT ${safeLimit} OFFSET ${offset}`;
    const countQuery = `SELECT COUNT(*) FROM profiles ${whereSql}`;

    const [dataRes, countRes] = await Promise.all([
        pool.query(dataQuery, values),
        pool.query(countQuery, values)
    ]);

    return {
        data: dataRes.rows,
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        limit: safeLimit
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