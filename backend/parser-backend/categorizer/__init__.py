"""
Bank-transaction categorizer (docs/CATEGORIZER_PLAN.md, Step 2).

Pure Python, no database, no network, no Claude API:
    rules (rules.py) -> local Naive Bayes (model.py, model.json) -> 'other' + needs_review.

Entry point: categorizer.categorize.categorize(narration, debit, credit).
"""
