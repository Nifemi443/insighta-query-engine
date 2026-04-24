const parseQuery = (query) => {
    const q = query.toLowerCase();
    const filters = {};

    // 1. Gender Logic
    const mentionsMale = /\b(males?|men|man|boys?)\b/.test(q);
    const mentionsFemale = /\b(females?|women|woman|girls?)\b/.test(q);

    if (mentionsMale && !mentionsFemale) {
        filters.gender = 'male';
    } else if (mentionsFemale && !mentionsMale) {
        filters.gender = 'female';
    }
    // Both mentioned → no gender filter (all genders)

    // 2. Age group keywords (sets age_group field directly)
    if (/\b(child|children|kids?)\b/.test(q)) {
        filters.age_group = 'child';
    } else if (/\bteenagers?\b/.test(q)) {
        filters.age_group = 'teenager';
    } else if (/\badults?\b/.test(q)) {
        filters.age_group = 'adult';
    } else if (/\bseniors?\b/.test(q)) {
        filters.age_group = 'senior';
    }

    // 3. "young" → age range 16–24 (per spec, NOT a stored age_group)
    if (/\byoung\b/.test(q) && !filters.age_group) {
        filters.min_age = 16;
        filters.max_age = 24;
    }

    // 4. Dynamic numeric age extraction
    // FIX: "above 30" → min_age=30 (not 31). Spec says "females above 30" → min_age=30
    const aboveMatch = q.match(/\b(?:above|over|older than)\s+(\d+)/);
    if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]);

    const belowMatch = q.match(/\b(?:under|below|younger than)\s+(\d+)/);
    if (belowMatch) filters.max_age = parseInt(belowMatch[1]);

    const betweenMatch = q.match(/\bbetween\s+(\d+)\s+and\s+(\d+)/);
    if (betweenMatch) {
        filters.min_age = parseInt(betweenMatch[1]);
        filters.max_age = parseInt(betweenMatch[2]);
    }

    // 5. Country mapping
    const countries = {
        'nigeria': 'NG',   'nigerian': 'NG',
        'kenya': 'KE',     'kenyan': 'KE',
        'ghana': 'GH',     'ghanaian': 'GH',
        'south africa': 'ZA', 'south african': 'ZA',
        'ethiopia': 'ET',  'ethiopian': 'ET',
        'egypt': 'EG',     'egyptian': 'EG',
        'tanzania': 'TZ',  'tanzanian': 'TZ',
        'uganda': 'UG',    'ugandan': 'UG',
        'senegal': 'SN',   'senegalese': 'SN',
        'cameroon': 'CM',  'cameroonian': 'CM',
        'angola': 'AO',    'angolan': 'AO',
        'rwanda': 'RW',    'rwandan': 'RW',
        'zambia': 'ZM',    'zambian': 'ZM',
        'zimbabwe': 'ZW',  'zimbabwean': 'ZW',
        'mali': 'ML',      'malian': 'ML',
        'benin': 'BJ',     'beninese': 'BJ',
        'togo': 'TG',      'togolese': 'TG',
        'niger': 'NE',     'nigerien': 'NE',
        'somalia': 'SO',   'somali': 'SO',
        'sudan': 'SD',     'sudanese': 'SD',
        'liberia': 'LR',   'liberian': 'LR',
        'guinea': 'GN',    'guinean': 'GN',
        'chad': 'TD',      'chadian': 'TD',
        'gabon': 'GA',     'gabonese': 'GA',
        'botswana': 'BW',
        'namibia': 'NA',   'namibian': 'NA',
        'gambia': 'GM',    'gambian': 'GM',
        'morocco': 'MA',   'moroccan': 'MA',
        'algeria': 'DZ',   'algerian': 'DZ',
        'tunisia': 'TN',   'tunisian': 'TN',
        'libya': 'LY',     'libyan': 'LY',
        'mozambique': 'MZ', 'malawi': 'MW',
        'usa': 'US',       'american': 'US', 'united states': 'US',
        'uk': 'GB',        'british': 'GB',  'united kingdom': 'GB',
        'france': 'FR',    'french': 'FR',
        'germany': 'DE',   'german': 'DE',
        'india': 'IN',     'indian': 'IN',
        'brazil': 'BR',    'brazilian': 'BR',
        'canada': 'CA',    'canadian': 'CA',
    };

    // Try multi-word first, then single word — first match wins
    let matched = false;
    for (const [name, id] of Object.entries(countries)) {
        if (name.includes(' ') && q.includes(name)) {
            filters.country_id = id;
            matched = true;
            break;
        }
    }
    if (!matched) {
        for (const [name, id] of Object.entries(countries)) {
            const regex = new RegExp(`\\b${name}\\b`);
            if (regex.test(q)) {
                filters.country_id = id;
                break;
            }
        }
    }

    return filters;
};

module.exports = { parseQuery };