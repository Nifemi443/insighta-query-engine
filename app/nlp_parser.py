"""
Rule-based natural language parser for profile search queries.
No AI/LLMs used — pure keyword matching and pattern extraction.
"""

import re
from typing import Optional

# Country name → ISO 2-letter code mapping
COUNTRY_MAP = {
    "nigeria": "NG", "nigerian": "NG",
    "ghana": "GH", "ghanaian": "GH",
    "kenya": "KE", "kenyan": "KE",
    "south africa": "ZA", "south african": "ZA",
    "ethiopia": "ET", "ethiopian": "ET",
    "egypt": "EG", "egyptian": "EG",
    "tanzania": "TZ", "tanzanian": "TZ",
    "uganda": "UG", "ugandan": "UG",
    "angola": "AO", "angolan": "AO",
    "mozambique": "MZ", "mozambican": "MZ",
    "cameroon": "CM", "cameroonian": "CM",
    "senegal": "SN", "senegalese": "SN",
    "mali": "ML", "malian": "ML",
    "zambia": "ZM", "zambian": "ZM",
    "zimbabwe": "ZW", "zimbabwean": "ZW",
    "benin": "BJ", "beninese": "BJ",
    "togo": "TG", "togolese": "TG",
    "niger": "NE", "nigerien": "NE",
    "chad": "TD", "chadian": "TD",
    "sudan": "SD", "sudanese": "SD",
    "somalia": "SO", "somali": "SO",
    "rwanda": "RW", "rwandan": "RW",
    "burundi": "BI", "burundian": "BI",
    "sierra leone": "SL",
    "liberia": "LR", "liberian": "LR",
    "guinea": "GN", "guinean": "GN",
    "ivory coast": "CI", "côte d'ivoire": "CI", "cote d'ivoire": "CI",
    "burkina faso": "BF",
    "mauritania": "MR", "mauritanian": "MR",
    "gambia": "GM", "gambian": "GM",
    "cape verde": "CV",
    "gabon": "GA", "gabonese": "GA",
    "congo": "CG", "congolese": "CG",
    "democratic republic of congo": "CD", "drc": "CD",
    "malawi": "MW", "malawian": "MW",
    "lesotho": "LS",
    "botswana": "BW", "botswanan": "BW",
    "namibia": "NA", "namibian": "NA",
    "eswatini": "SZ", "swaziland": "SZ",
    "eritrea": "ER", "eritrean": "ER",
    "djibouti": "DJ",
    "comoros": "KM",
    "seychelles": "SC",
    "madagascar": "MG", "malagasy": "MG",
    "mauritius": "MU", "mauritian": "MU",
    "libya": "LY", "libyan": "LY",
    "algeria": "DZ", "algerian": "DZ",
    "morocco": "MA", "moroccan": "MA",
    "tunisia": "TN", "tunisian": "TN",
    "united states": "US", "usa": "US", "american": "US",
    "united kingdom": "GB", "uk": "GB", "british": "GB",
    "canada": "CA", "canadian": "CA",
    "australia": "AU", "australian": "AU",
    "india": "IN", "indian": "IN",
    "china": "CN", "chinese": "CN",
    "brazil": "BR", "brazilian": "BR",
    "france": "FR", "french": "FR",
    "germany": "DE", "german": "DE",
    "italy": "IT", "italian": "IT",
    "spain": "ES", "spanish": "ES",
    "portugal": "PT", "portuguese": "PT",
    "japan": "JP", "japanese": "JP",
    "russia": "RU", "russian": "RU",
}

# Age group keywords
AGE_GROUP_KEYWORDS = {
    "child": "child",
    "children": "child",
    "kid": "child",
    "kids": "child",
    "teenager": "teenager",
    "teenagers": "teenager",
    "teen": "teenager",
    "teens": "teenager",
    "adolescent": "teenager",
    "adult": "adult",
    "adults": "adult",
    "senior": "senior",
    "seniors": "senior",
    "elderly": "senior",
    "elder": "senior",
    "old": "senior",
}

# Gender keywords
GENDER_KEYWORDS = {
    "male": "male",
    "males": "male",
    "man": "male",
    "men": "male",
    "boy": "male",
    "boys": "male",
    "female": "female",
    "females": "female",
    "woman": "female",
    "women": "female",
    "girl": "female",
    "girls": "female",
}

# "young" is a special keyword → ages 16–24 (not a stored age_group)
YOUNG_KEYWORDS = {"young", "youth", "youths"}


class ParsedQuery:
    def __init__(self):
        self.gender: Optional[str] = None
        self.age_group: Optional[str] = None
        self.country_id: Optional[str] = None
        self.min_age: Optional[int] = None
        self.max_age: Optional[int] = None

    def is_empty(self) -> bool:
        return all(
            v is None
            for v in [self.gender, self.age_group, self.country_id, self.min_age, self.max_age]
        )


def parse_query(q: str) -> Optional[ParsedQuery]:
    """
    Parse a natural language query string into filter parameters.
    Returns None if the query cannot be interpreted.
    """
    if not q or not q.strip():
        return None

    text = q.lower().strip()
    result = ParsedQuery()

    # --- Gender detection ---
    for keyword, gender_val in GENDER_KEYWORDS.items():
        if re.search(rf"\b{re.escape(keyword)}\b", text):
            result.gender = gender_val
            break

    # --- Age group detection ---
    for keyword, group_val in AGE_GROUP_KEYWORDS.items():
        if re.search(rf"\b{re.escape(keyword)}\b", text):
            result.age_group = group_val
            break

    # --- "young" keyword → min_age=16, max_age=24 ---
    for keyword in YOUNG_KEYWORDS:
        if re.search(rf"\b{re.escape(keyword)}\b", text):
            result.min_age = 16
            result.max_age = 24
            break

    # --- Explicit age modifiers ---
    # "above N" / "over N" / "older than N"
    above_match = re.search(r"\b(?:above|over|older than)\s+(\d+)\b", text)
    if above_match:
        result.min_age = int(above_match.group(1))

    # "below N" / "under N" / "younger than N"
    below_match = re.search(r"\b(?:below|under|younger than)\s+(\d+)\b", text)
    if below_match:
        result.max_age = int(below_match.group(1))

    # "between N and M"
    between_match = re.search(r"\bbetween\s+(\d+)\s+and\s+(\d+)\b", text)
    if between_match:
        result.min_age = int(between_match.group(1))
        result.max_age = int(between_match.group(2))

    # "aged N" / "age N"
    aged_match = re.search(r"\baged?\s+(\d+)\b", text)
    if aged_match:
        result.min_age = int(aged_match.group(1))
        result.max_age = int(aged_match.group(1))

    # --- Country detection (longest match first to catch "south africa" etc.) ---
    sorted_countries = sorted(COUNTRY_MAP.keys(), key=len, reverse=True)
    for country_name in sorted_countries:
        if country_name in text:
            result.country_id = COUNTRY_MAP[country_name]
            break

    # --- "from <country>" / "in <country>" patterns ---
    from_match = re.search(r"\b(?:from|in)\s+([a-z\s]+?)(?:\s+(?:and|or|with|who|that|aged?|above|below|over|under)|$)", text)
    if from_match and result.country_id is None:
        phrase = from_match.group(1).strip()
        for country_name in sorted_countries:
            if country_name in phrase:
                result.country_id = COUNTRY_MAP[country_name]
                break

    if result.is_empty():
        return None

    return result
