# SOMMA catalog source datasets

Drop open-source exports anywhere under this folder (any depth). The importer recursively scans for `.csv`, `.json`, and `.xml` files.

## Current layout (example)

| Path | Source |
|------|--------|
| `final_exercise_dataset.csv` | ExerciseDB / Kaggle |
| `Poses.json` | Yoga poses (English + Sanskrit + image URL) |
| `wger-master/wger/exercises/fixtures/` | Wger Django fixtures (`exercise-base-data.json`, `translations.json`, …) |

## Run

```bash
pip install -r scripts/requirements-catalog.txt
python scripts/import_catalog.py
```

Output: `supabase/migrations/017_global_catalog_seed.sql` (batched `INSERT … ON CONFLICT` statements).

Options:

```bash
python scripts/import_catalog.py --batch-size 500
python scripts/import_catalog.py --download-assets   # optional local clip download
```
