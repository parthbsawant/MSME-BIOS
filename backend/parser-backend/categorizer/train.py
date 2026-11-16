"""
Train the Naive Bayes model on the labelled bank CSV and write model.json.

    python -m categorizer.train                      (from backend/parser-backend)
    python -m categorizer.train --csv <file> --out <file>

Uses split == 'train' rows, both variants, label = label_stage1.
Rows labelled 'other' are NOT trained on: 'other' means "not recognised",
so the model must reject unfamiliar text on its own, not memorise it.
"""

import argparse
import csv
import os

from .categorize import MODEL_PATH
from .model import NaiveBayes

DEFAULT_CSV = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "tests", "fixtures", "categorizer", "bank_labeled.csv"
)


def load_rows(path: str, split: str):
    with open(path, encoding="utf-8", newline="") as f:
        return [r for r in csv.DictReader(f) if r["split"] == split]


def train(csv_path: str = DEFAULT_CSV) -> NaiveBayes:
    rows = [r for r in load_rows(csv_path, "train") if r["label_stage1"] != "other"]
    return NaiveBayes().fit((r["narration"], r["label_stage1"]) for r in rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=DEFAULT_CSV)
    ap.add_argument("--out", default=MODEL_PATH)
    args = ap.parse_args()

    model = train(args.csv)
    model.save(args.out)
    size_kb = os.path.getsize(args.out) / 1024
    print(f"trained on {sum(model.doc_counts.values())} rows, {len(model.doc_counts)} classes, "
          f"{model.vocab_size} tokens -> {args.out} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
