// parser.js
const parseQuery = (queryStr) => {
    const q = queryStr.toLowerCase();
    const filters = {};
    let found = false;

    // 1. Gender mapping
    if (/\b(male|males|men|man|boy)\b/.test(q)) { filters.gender = 'male'; found = true; }
    if (/\b(female|females|women|woman|girl)\b/.test(q)) { filters.gender = 'female'; found = true; }

    // 2. Age Groups
    const ageGroups = ['child', 'teenager', 'adult', 'senior'];
    ageGroups.forEach(group => {
        if (q.includes(group)) { filters.age_group = group; found = true; }
    });

    // 3. The "Young" Special Rule (16-24)
    if (/\byoung\b/.test(q)) {
        filters.min_age = 16;
        filters.max_age = 24;
        found = true;
    }

    // 4. Numeric Age Extraction (e.g., "above 30")
    const aboveMatch = q.match(/(?:above|over|older than)\s+(\d+)/);
    if (aboveMatch) { filters.min_age = parseInt(aboveMatch[1]); found = true; }

    const belowMatch = q.match(/(?:below|under|younger than)\s+(\d+)/);
    if (belowMatch) { filters.max_age = parseInt(belowMatch[1]); found = true; }

    // 5. Country Mapping (Expand this list based on your JSON data)
    const countries = { 'nigeria': 'NG', 'kenya': 'KE', 'angola': 'AO', 'benin': 'BJ' };
    for (const [name, code] of Object.entries(countries)) {
        if (q.includes(name)) { filters.country_id = code; found = true; }
    }

    return found ? filters : null;
};

module.exports = { parseQuery };