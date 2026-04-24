// seed.js
const { Pool } = require('pg');
const { uuidv7 } = require('uuidv7');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    const path = require('path'); // Add this at the top
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json'), 'utf8'));
    
    const query = `
        INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (name) DO NOTHING;
    `;

    console.log("Seeding started...");
    for (const p of data) {
        await pool.query(query, [
            uuidv7(), p.name, p.gender, p.gender_probability, 
            p.age, p.age_group, p.country_id, p.country_name, p.country_probability
        ]);
    }
    console.log("Seeding complete!");
    process.exit();
}

seed();