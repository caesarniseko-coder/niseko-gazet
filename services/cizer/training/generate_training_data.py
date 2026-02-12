# /// script
# dependencies = ["datasets", "huggingface_hub"]
# ///
"""
Generate additional training examples for Cizer editorial model.

Reads seed data from data/training-seed.json, and can be extended
to generate synthetic variations for SFT/DPO training.

Usage:
    uv run services/cizer/training/generate_training_data.py \
        --seed-file data/training-seed.json \
        --output-repo caesarniseko/niseko-gazet-editorial-data
"""

import argparse
import json
import os
from pathlib import Path

from datasets import Dataset
from huggingface_hub import HfApi


def load_seed_data(seed_file: str) -> list[dict]:
    """Load seed training examples from JSON file."""
    with open(seed_file) as f:
        return json.load(f)


def transform_to_chat_format(examples: list[dict]) -> list[dict]:
    """Transform seed examples into chat format rows for HF dataset."""
    rows = []
    for ex in examples:
        messages = ex["messages"]
        field_note = messages[1]["content"]  # user message = field note JSON
        article_output = messages[2]["content"]  # assistant message = article JSON

        # Parse the article output to extract risk flags
        try:
            article = json.loads(article_output)
            risk_flags = article.get("risk_flags", [])
        except json.JSONDecodeError:
            risk_flags = []

        rows.append({
            "messages": messages,
            "field_note": field_note,
            "article_output": article_output,
            "risk_flags": json.dumps(risk_flags),
            "scenario": ex.get("scenario", ""),
            "complexity": ex.get("complexity", "simple"),
        })
    return rows


def push_to_hub(rows: list[dict], repo_id: str):
    """Push training data rows to HuggingFace Hub dataset."""
    dataset = Dataset.from_list(rows)
    dataset.push_to_hub(repo_id, private=True)
    print(f"Pushed {len(rows)} examples to {repo_id}")


def main():
    parser = argparse.ArgumentParser(description="Generate Cizer training data")
    parser.add_argument("--seed-file", required=True, help="Path to seed JSON file")
    parser.add_argument("--output-repo", required=True, help="HF Hub dataset repo ID")
    parser.add_argument("--dry-run", action="store_true", help="Print data without pushing")
    args = parser.parse_args()

    # Load and transform
    seed_data = load_seed_data(args.seed_file)
    print(f"Loaded {len(seed_data)} seed examples")

    rows = transform_to_chat_format(seed_data)
    print(f"Transformed into {len(rows)} training rows")

    if args.dry_run:
        for i, row in enumerate(rows):
            print(f"\n--- Example {i+1} ({row['complexity']}) ---")
            print(f"Scenario: {row['scenario']}")
            print(f"Risk flags: {row['risk_flags']}")
    else:
        push_to_hub(rows, args.output_repo)


if __name__ == "__main__":
    main()
