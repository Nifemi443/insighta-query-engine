# Insighta Labs: Intelligence Query Engine

This is a high-performance demographic intelligence API built for **Insighta Labs**. It allows marketing and growth teams to slice, filter, and search through demographic profiles using both standard API parameters and Natural Language Queries.

---

## 🚀 Features
* **Advanced Filtering:** Filter by gender, age, country, and probability scores.
* **Natural Language Search:** Convert plain English queries into complex SQL filters.
* **Performance Optimized:** Strategic B-Tree indexing on core columns to prevent full-table scans.
* **Deterministic Parsing:** Rule-based NLP for 0ms interpretation latency without LLM overhead.
* **Scalable Pagination:** Consistent `page` and `limit` controls across all endpoints.

---

## 🧠 Natural Language Parsing Approach

The core of this engine is a **deterministic, rule-based parser** located in `parser.js`. Unlike AI-based solutions, this approach ensures consistent results and zero "hallucinations."

### How it Works:
1.  **Normalization:** The input query is converted to lowercase and stripped of unnecessary punctuation.
2.  **Keyword Mapping:** A pre-defined dictionary maps common English terms to database enums:
    * `males, men, boy` → `gender: 'male'`
    * `females, women, girl` → `gender: 'female'`
3.  **Regex Extraction:** Dynamic Regular Expressions are used to identify age boundaries:
    * `above/over [number]` → Sets `min_age`
    * `under/below [number]` → Sets `max_age`
4.  **Semantic Mapping:** Specific terms like **"young"** are semantically mapped to an industry-standard range of **16–24**.
5.  **Geospatial Logic:** A country dictionary maps full names (e.g., "Nigeria") or demonyms ("Nigerian") to ISO-2 codes (`NG`) used in the database.

---

## ⚠️ Limitations & Edge Cases

While the parser is robust for common queries, it has specific architectural boundaries:

* **Boolean logic (OR/NOT):** The parser currently assumes all identified keywords are cumulative (`AND` logic). It cannot process queries like "males from Nigeria OR Kenya."
* **Negative Queries:** Exclusions such as "people NOT from Angola" are not currently supported.
* **Contextual Ambiguity:** If a query contains multiple conflicting age indicators (e.g., "adults under 12"), the parser will prioritize the numeric regex over the age group keyword.
* **Dictionary Constraints:** Only countries explicitly defined in the parser's mapping dictionary will be recognized.
* **Slang/Synonyms:** Non-mapped synonyms (e.g., "blokes," "elderly," "toddlers") will not trigger filters unless added to the rule set.

---

## 🛠 Tech Stack
* **Runtime:** Node.js
* **Framework:** Express.js
* **Database:** PostgreSQL (Supabase)
* **ID Standard:** UUID v7

---

## 🚦 Getting Started

1.  **Clone & Install:**
    ```bash
    npm install
    ```
2.  **Environment Setup:**
    Create a `.env` file with your `DATABASE_URL`.
3.  **Seed Database:**
    ```bash
    node seed.js
    ```
4.  **Launch:**
    ```bash
    node server.js
    ```