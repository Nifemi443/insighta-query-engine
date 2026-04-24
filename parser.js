const parseQuery = (query) => {
    const q = query.toLowerCase();
    const filters = {};

    // 1. Gender Logic (Handle 'Male and Female' case)
    const mentionsMale = q.includes('male') || q.includes('men') || q.includes('boy');
    const mentionsFemale = q.includes('female') || q.includes('women') || q.includes('girl');

    if (mentionsMale && mentionsFemale) {
        // Both mentioned: Do not set a gender filter (returns all)
    } else if (mentionsMale) {
        filters.gender = 'male';
    } else if (mentionsFemale) {
        filters.gender = 'female';
    }

    // 2. Age Keyword Mapping
    if (q.includes('young') || q.includes('teenager') || q.includes('youth')) {
        filters.min_age = 13;
        filters.max_age = 24;
    } else if (q.includes('adult')) {
        filters.min_age = 25;
        filters.max_age = 65;
    }

    // 3. Dynamic Age Extraction (Priority over keywords)
    const aboveMatch = q.match(/(?:above|over|older than|>\s?)\s?(\d+)/);
    if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]) + 1;

    const belowMatch = q.match(/(?:under|below|younger than|<\s?)\s?(\d+)/);
    if (belowMatch) filters.max_age = parseInt(belowMatch[1]) - 1;

    // 4. Country Mapping
    // Instead of 'break', check for multiple possibilities
    const countries = {
        'nigeria': 'NG', 'nigerian': 'NG',
        'kenya': 'KE', 'kenyan': 'KE',
        'ghana': 'GH', 'ghanaian': 'GH',
        'usa': 'US', 'america': 'US',
        'uk': 'GB', 'london': 'GB'
    };

    for (const [name, id] of Object.entries(countries)) {
        if (q.includes(name)) {
            filters.country_id = id;
            // No break here, let it finish checking
        }
    }

    return filters;
};

module.exports = { parseQuery };