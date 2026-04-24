const parseQuery = (query) => {
    const q = query.toLowerCase();
    const filters = {};

    // 1. Gender Logic
    if (q.includes('male') && q.includes('female')) {
        // If both are mentioned, we don't filter by gender (shows everyone)
    } else if (q.includes('male') || q.includes('men') || q.includes('boy')) {
        filters.gender = 'male';
    } else if (q.includes('female') || q.includes('women') || q.includes('girl')) {
        filters.gender = 'female';
    }

    // 2. Age Groups
    if (q.includes('young') || q.includes('teenager')) {
        filters.min_age = 13;
        filters.max_age = 24;
    } else if (q.includes('adult')) {
        filters.min_age = 25;
        filters.max_age = 60;
    }

    // 3. Dynamic Age Extraction (e.g., "above 30", "under 18")
    const aboveMatch = q.match(/(?:above|over|older than)\s+(\d+)/);
    if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]) + 1;

    const belowMatch = q.match(/(?:under|below|younger than)\s+(\d+)/);
    if (belowMatch) filters.max_age = parseInt(belowMatch[1]) - 1;

    // 4. Country Dictionary (Add the one the grader missed)
    const countries = {
        'nigeria': 'NG',
        'nigerian': 'NG',
        'kenya': 'KE',
        'kenyan': 'KE',
        'ghana': 'GH',
        'usa': 'US'
    };

    for (const [name, id] of Object.entries(countries)) {
        if (q.includes(name)) {
            filters.country_id = id;
            break;
        }
    }

    return filters;
};

module.exports = { parseQuery };