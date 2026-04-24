const { Pool } = require('pg');
const { uuidv7 } = require('uuidv7');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    const seedPath = path.join(__dirname, 'seed_profiles.json');
    const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const data = Array.isArray(raw) ? raw : raw.profiles;

    const query = `
        INSERT INTO profiles (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (name) DO NOTHING;
    `;

    console.log(`Seeding ${data.length} profiles from seed_profiles.json ...`);
    for (const p of data) {
        await pool.query(query, [
            uuidv7(),
            p.name,
            p.gender,
            p.gender_probability,
            p.age,
            p.age_group,
            p.country_id,
            p.country_name,
            p.country_probability
        ]);
    }
    console.log('Seeding complete (duplicates skipped via ON CONFLICT (name)).');
    process.exit(0);
}

seed().catch((e) => {
    console.error(e);
    process.exit(1);
});
