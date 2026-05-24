#!/usr/bin/env python3
"""Apply 017_global_catalog_seed.sql in API-safe chunks via Supabase CLI."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SEED = REPO_ROOT / "supabase" / "migrations" / "017_global_catalog_seed.sql"
HEADER_END_MARKER = "-- library_exercises batch"
MAX_BATCH_KB = 350
ROWS_PER_SUBBATCH = 80


def split_seed_sql(text: str) -> list[tuple[str, str]]:
    lines = text.splitlines()
    header_end = next(
        i for i, line in enumerate(lines) if line.startswith(HEADER_END_MARKER)
    )
    header = "\n".join(lines[:header_end]).strip()

    chunks: list[tuple[str, str]] = []
    batch_starts = [
        i
        for i, line in enumerate(lines)
        if line.startswith("-- library_") and " batch " in line
    ]

    for index, start in enumerate(batch_starts):
        end = batch_starts[index + 1] if index + 1 < len(batch_starts) else len(lines)
        label = lines[start].removeprefix("-- ").strip()
        body = "\n".join(lines[start:end]).strip()
        chunks.append((label, f"{header}\n\n{body}\n"))

    return chunks


def split_insert_batch(sql: str, label: str) -> list[tuple[str, str]]:
    size_kb = len(sql.encode("utf-8")) / 1024
    if size_kb <= MAX_BATCH_KB:
        return [(label, sql)]

    match = re.search(
        r"(?s)(insert into public\.\w+ \([\s\S]*?\) values\n)([\s\S]*?)(\non conflict[\s\S]*)",
        sql,
    )
    if not match:
        return [(label, sql)]

    prefix, values_block, suffix = match.groups()
    rows = re.findall(r"(?s)  \(\n[\s\S]*?\n  \)(?:,|\n)", values_block + "\n")
    if not rows:
        return [(label, sql)]

    sub_batches: list[tuple[str, str]] = []
    for chunk_index in range(0, len(rows), ROWS_PER_SUBBATCH):
        chunk = rows[chunk_index : chunk_index + ROWS_PER_SUBBATCH]
        normalized = []
        for row_index, row in enumerate(chunk):
            cleaned = row.rstrip()
            if cleaned.endswith(","):
                cleaned = cleaned[:-1]
            if row_index < len(chunk) - 1 and not cleaned.endswith(","):
                cleaned += ","
            normalized.append(cleaned)
        body = prefix + "\n".join(normalized) + suffix
        part = chunk_index // ROWS_PER_SUBBATCH + 1
        total = (len(rows) + ROWS_PER_SUBBATCH - 1) // ROWS_PER_SUBBATCH
        sub_batches.append((f"{label} part {part}/{total}", body))

    return sub_batches


def run_batch(sql: str, label: str, dry_run: bool) -> None:
    temp_dir = REPO_ROOT / "supabase" / "migrations" / ".seed_batches"
    temp_dir.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", label)
    path = temp_dir / f"{safe_name}.sql"
    path.write_text(sql, encoding="utf-8")
    size_kb = path.stat().st_size / 1024
    print(f"[apply] {label} ({size_kb:.1f} KB)")

    if dry_run:
        return

    result = subprocess.run(
        " ".join(
            [
                "npx",
                "--yes",
                "supabase@latest",
                "db",
                "query",
                "--linked",
                "--yes",
                "-f",
                str(path),
            ]
        ),
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        shell=True,
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(f"Batch failed: {label}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--seed-file",
        type=Path,
        default=DEFAULT_SEED,
        help="Path to 017_global_catalog_seed.sql",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    text = args.seed_file.read_text(encoding="utf-8")
    chunks = split_seed_sql(text)
    print(f"Found {len(chunks)} top-level batches in {args.seed_file.name}")

    applied = 0
    for label, sql in chunks:
        for sub_label, sub_sql in split_insert_batch(sql, label):
            run_batch(sub_sql, sub_label, args.dry_run)
            applied += 1

    print(f"Completed {applied} seed sub-batches.")


if __name__ == "__main__":
    main()
