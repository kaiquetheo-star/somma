#!/usr/bin/env python3
"""
SOMMA Global Catalog — Massive Ingestion Pipeline
=================================================
Recursively scans datasets/ for .csv, .json, and .xml files, normalizes rows into a
unified schema, deduplicates by slug/name, and writes batched PostgreSQL migrations.

Output: supabase/migrations/017_global_catalog_seed.sql

Requirements:
  pip install -r scripts/requirements-catalog.txt

Usage:
  python scripts/import_catalog.py
  python scripts/import_catalog.py --datasets-dir ./datasets --batch-size 500
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from html import unescape
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator
from urllib.parse import urljoin, urlparse

import pandas as pd

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    tqdm = None  # type: ignore

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DOWNLOAD_ASSETS_LOCAL = False

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASETS_DIR = REPO_ROOT / "datasets"
DEFAULT_OUTPUT = REPO_ROOT / "supabase" / "migrations" / "017_global_catalog_seed.sql"
DEFAULT_BATCH_SIZE = 500

EXERCISEDB_GIF_BASE_URL = "https://static.exercisedb.dev/media/gifs/"
WGER_MEDIA_BASE_URL = "https://wger.de/media/"

SOMMA_CATALOG_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
WGER_ENGLISH_LANGUAGE_ID = 2

MODULAR_VISUAL_TYPES = frozenset({"mp4", "webm", "gif", "webp"})
VISUAL_QUALITY_SCORE = {
    "mp4": 100,
    "webm": 95,
    "gif": 80,
    "webp": 70,
    "png": 40,
    "jpg": 35,
    "jpeg": 35,
    "svg": 20,
    "lottie": 10,
}

SKIP_PATH_FRAGMENTS = (
    "node_modules",
    ".github",
    "package.json",
    "package-lock.json",
    "muscles.json",
    "equipment.json",
    "categories.json",
    "/test-",
    "test-weight",
    "test-nutrition",
    "test-measurement",
    "test-workout",
    "test-routine",
    "test-apikeys",
    "test-gym",
    "test-gallery",
    "test-user",
    "test-licenses",
    "users.json",
    "groups.json",
    "languages.json",
    "licenses.json",
    "setting_",
    "gym.json",
    "gym-config",
    "gym_config",
    "trophies",
    "nutrition",
    "measurements",
    "manager/fixtures",
    "weight/fixtures",
)

COMBAT_NAME_KEYWORDS = (
    "boxing",
    "boxer",
    "kickboxing",
    "muay thai",
    "martial",
    "karate",
    "taekwondo",
    "shadow box",
    "heavy bag",
    "jab",
    "cross",
    "hook",
    "uppercut",
    "roundhouse",
    "sprawl",
)

# ---------------------------------------------------------------------------
# Schema key maps (source field → canonical)
# ---------------------------------------------------------------------------

NAME_KEYS = (
    "name",
    "Name",
    "exercise_name",
    "english_name",
    "englishName",
    "combo_name",
    "session_name",
    "title",
)
VISUAL_KEYS = (
    "visual_asset_url",
    "gifUrl",
    "gif_url",
    "videoUrl",
    "video_url",
    "image_url",
    "imageUrl",
    "img_url",
    "logo_url",
    "logoUrl",
    "thumbnail",
    "image",
    "photo",
    "pose_url",
)
TARGET_KEYS = (
    "target",
    "targetMuscles",
    "target_muscles",
    "primary_muscle",
    "bodyPart",
    "body_part",
    "muscle",
    "targetMuscle",
)
SECONDARY_KEYS = (
    "secondaryMuscles",
    "secondary_muscles",
    "synergist_muscles",
    "muscles_secondary",
)
EQUIPMENT_KEYS = (
    "equipment",
    "equipments",
    "equipment_required",
)
INSTRUCTION_KEYS = (
    "instructions",
    "instruction",
    "description",
    "description_source",
    "biomechanical_instructions",
    "overview",
    "steps",
)
SANSKRIT_KEYS = ("sanskrit_name", "sanskritName", "sanskrit")
PILLAR_KEYS = ("pillar", "Pillar", "type")


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class InstructionSource:
    source: str
    file: str
    steps: list[str] = field(default_factory=list)
    description: str = ""


@dataclass
class CatalogRecord:
    """Unified master record before SQL emission."""

    slug: str
    name: str
    pillar: str  # iron | combat | spirit
    target_muscles: list[str] = field(default_factory=list)
    secondary_muscles: list[str] = field(default_factory=list)
    equipment: list[str] = field(default_factory=list)
    instruction_sources: list[InstructionSource] = field(default_factory=list)
    visual_asset_url: str | None = None
    visual_asset_type: str | None = None
    visual_score: int = 0
    movement_pattern: str | None = None
    body_part: str | None = None
    description: str = ""
    sanskrit_name: str | None = None
    # Combat-only
    sequence: list[str] | None = None
    complexity_level: int | None = None
    tactical_focus: str | None = None
    # Spirit-only
    duration_minutes: int = 5
    complexity_tier: int = 1
    is_dynamic_flow: bool = False
    default_hold_seconds: int = 45
    target_recovery_zones: list[str] = field(default_factory=list)
    merge_names: set[str] = field(default_factory=set)

    def normalized_name(self) -> str:
        return normalize_name(self.name)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


def progress_iter(items: Iterable[Any], desc: str, total: int | None = None) -> Iterator[Any]:
    """Yield items with tqdm or lightweight percentage logging."""
    if isinstance(items, list):
        items_list = items
    else:
        items_list = list(items)

    total_count = total if total is not None else len(items_list)
    if tqdm is not None:
        for item in tqdm(items_list, desc=desc, total=total_count):
            yield item
        return

    for index, item in enumerate(items_list, start=1):
        if index == 1 or index % max(1, total_count // 20) == 0 or index == total_count:
            pct = (index / total_count) * 100 if total_count else 100
            print(f"  [{desc}] {index}/{total_count} ({pct:.0f}%)")
        yield item


def stable_id(slug: str) -> str:
    return str(uuid.uuid5(SOMMA_CATALOG_NAMESPACE, f"somma.catalog.{slug}"))


def normalize_name(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"[\u2019']", "", text)
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def slugify(value: str) -> str:
    text = normalize_name(value)
    text = re.sub(r"\s+", "_", text)
    return text[:120] or "movement"


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def sql_literal(value: str | None) -> str:
    if value is None:
        return "NULL"
    return f"'{sql_escape(value)}'"


def sql_array(values: list[str]) -> str:
    if not values:
        return "array[]::text[]"
    return f"array[{', '.join(sql_literal(v) for v in values)}]"


def strip_html(text: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"\s+", " ", text).strip()


def first_present(row: Mapping[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in row and row[key] is not None and row[key] != "":
            return row[key]
    return None


def parse_listish(value: Any) -> list[str]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        if text.startswith("[") and text.endswith("]"):
            try:
                parsed = ast.literal_eval(text)
                if isinstance(parsed, list):
                    return [str(v).strip() for v in parsed if str(v).strip()]
            except (SyntaxError, ValueError):
                pass
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(v).strip() for v in parsed if str(v).strip()]
            except json.JSONDecodeError:
                pass
        if ";" in text:
            return [p.strip() for p in text.split(";") if p.strip()]
        if "|" in text:
            return [p.strip() for p in text.split("|") if p.strip()]
        return [text]
    return [str(value).strip()]


def parse_instruction_steps(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        steps = []
        for item in value:
            text = strip_html(str(item).strip())
            text = re.sub(r"^step\s*:\s*\d+\s*", "", text, flags=re.I)
            if text:
                steps.append(text)
        return steps
    if isinstance(value, dict):
        for key in ("merged_steps", "steps", "cues"):
            if key in value:
                return parse_instruction_steps(value[key])
        return [strip_html(str(v)) for v in value.values() if v]
    text = strip_html(str(value))
    if not text:
        return []
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
    return sentences if len(sentences) > 1 else [text]


def infer_visual_type(url: str | None) -> str | None:
    if not url:
        return None
    path = urlparse(url).path.split("?")[0].split("#")[0]
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    if ext in MODULAR_VISUAL_TYPES:
        return ext
    if ext in {"png", "jpg", "jpeg"}:
        return "webp" if ext == "webp" else None  # png/jpg not in modular set — store url, type null
    if ext == "svg":
        return "svg"
    return None


def score_visual(url: str | None, asset_type: str | None) -> int:
    if not url:
        return 0
    score = 10
    if url.startswith("https://"):
        score += 15
    ext = asset_type or infer_visual_type(url) or ""
    score += VISUAL_QUALITY_SCORE.get(ext, 5)
    if "exercisedb" in url or "static.exercisedb" in url:
        score += 5
    return score


def resolve_url(raw: str | None, base: str | None = None) -> str | None:
    if not raw or not str(raw).strip():
        return None
    url = str(raw).strip()
    if url.startswith("http://") or url.startswith("https://"):
        return url
    if base:
        return urljoin(base.rstrip("/") + "/", url.lstrip("/"))
    return url


def normalize_muscle(value: str) -> str:
    text = normalize_name(value)
    mapping = {
        "pectoralis major": "chest",
        "pectorals": "chest",
        "upper arms": "biceps",
        "lower arms": "forearms",
        "upper legs": "quadriceps",
        "lower legs": "calves",
        "latissimus dorsi": "lats",
        "abs": "core",
        "abdominals": "core",
        "waist": "core",
        "delts": "delts",
        "shoulders": "delts",
        "biceps brachii": "biceps",
        "triceps brachii": "triceps",
        "gluteus maximus": "glutes",
    }
    return mapping.get(text, text.replace(" ", "_"))


def map_equipment_tag(raw: str) -> str:
    key = normalize_name(raw)
    mapping = {
        "barbell": "barbell",
        "dumbbell": "dumbbells",
        "cable": "cable",
        "body weight": "bodyweight",
        "bodyweight": "bodyweight",
        "machine": "full_gym",
        "leverage machine": "full_gym",
        "smith machine": "full_gym",
        "kettlebell": "kettlebells",
        "band": "bands",
        "resistance band": "bands",
        "ez barbell": "barbell",
        "olympic barbell": "barbell",
        "trap bar": "barbell",
        "pull up bar": "pull_up_bar",
        "weighted": "full_gym",
        "assisted": "full_gym",
    }
    tag = mapping.get(key, key.replace(" ", "_"))
    if tag in {"barbell", "cable", "dumbbells", "full_gym"}:
        return tag
    return tag


def infer_pillar(row: Mapping[str, Any], name: str) -> str:
    explicit = first_present(row, PILLAR_KEYS)
    if isinstance(explicit, str):
        value = explicit.lower().strip()
        if value in {"iron", "combat", "spirit", "flow"}:
            return "spirit" if value == "flow" else value

    if first_present(row, SANSKRIT_KEYS) or "poses" in str(row.get("_file_hint", "")).lower():
        return "spirit"

    lower = name.lower()
    if any(keyword in lower for keyword in COMBAT_NAME_KEYWORDS):
        return "combat"

    category = str(first_present(row, ("category", "bodyPart", "body_part")) or "").lower()
    if category in {"cardio", "plyometrics"} and "yoga" not in lower:
        if any(k in lower for k in COMBAT_NAME_KEYWORDS):
            return "combat"

    return "iron"


def infer_movement_pattern(body_part: str | None, category: str | None) -> str | None:
    text = normalize_name(f"{body_part or ''} {category or ''}")
    if any(k in text for k in ("chest", "push", "shoulder", "triceps")):
        return "push"
    if any(k in text for k in ("back", "lat", "pull", "biceps")):
        return "pull"
    if any(k in text for k in ("leg", "quad", "squat", "calf")):
        return "squat"
    if any(k in text for k in ("glute", "hamstring", "hinge", "deadlift")):
        return "hinge"
    if "arm" in text and "curl" in text:
        return "isolation"
    return None


def should_skip_file(path: Path) -> bool:
    name = path.name.lower()
    if name in {"package.json", "package-lock.json", "users.json", "groups.json", "languages.json", "licenses.json"}:
        return True

    path_str = str(path).replace("\\", "/").lower()

    # Keep exercise demo media fixtures used for catalog enrichment.
    if "test-exercise-images" in path_str or "test-exercise-videos" in path_str:
        return False

    if name in {"muscles.json", "equipment.json", "categories.json", "translations.json"}:
        return True

    return any(fragment in path_str for fragment in SKIP_PATH_FRAGMENTS)


def discover_files(datasets_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in datasets_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".csv", ".json", ".xml"}:
            continue
        if should_skip_file(path):
            continue
        files.append(path)
    return sorted(files, key=lambda p: str(p))


# ---------------------------------------------------------------------------
# Row → CatalogRecord (generic normalizer)
# ---------------------------------------------------------------------------


def row_to_partial_record(
    row: Mapping[str, Any],
    *,
    source: str,
    file_path: str,
) -> CatalogRecord | None:
    name_raw = first_present(row, NAME_KEYS)
    if not name_raw or not str(name_raw).strip():
        return None

    name = str(name_raw).strip()
    if len(name) < 2:
        return None

    sanskrit = first_present(row, SANSKRIT_KEYS)
    pillar = infer_pillar(row, name)
    slug = slugify(name)
    if sanskrit and pillar == "spirit":
        slug = slugify(f"{name}_{sanskrit}")

    target_raw = first_present(row, TARGET_KEYS)
    if target_raw is None and "target_muscles" in row:
        target_raw = row["target_muscles"]
    secondary_raw = first_present(row, SECONDARY_KEYS)
    if secondary_raw is None and "secondary_muscles" in row:
        secondary_raw = row["secondary_muscles"]
    equipment_raw = first_present(row, EQUIPMENT_KEYS)
    if equipment_raw is None and "equipment" in row:
        equipment_raw = row["equipment"]

    target = [normalize_muscle(v) for v in parse_listish(target_raw)]
    secondary = [normalize_muscle(v) for v in parse_listish(secondary_raw)]
    equipment = [map_equipment_tag(v) for v in parse_listish(equipment_raw)]
    equipment = sorted(set(equipment))

    steps = parse_instruction_steps(first_present(row, INSTRUCTION_KEYS))
    description = ""
    for key in ("description", "overview"):
        if row.get(key):
            description = strip_html(str(row[key]))
            break

    visual_raw = first_present(row, VISUAL_KEYS)
    visual_url = resolve_url(str(visual_raw) if visual_raw else None)
    if not visual_url and row.get("id") not in (None, ""):
        exercise_id = str(row.get("id")).strip().zfill(4)
        visual_url = resolve_url(f"{exercise_id}.gif", EXERCISEDB_GIF_BASE_URL)
    if visual_url and not visual_url.startswith("http"):
        if "exercise-images" in visual_url or visual_url.endswith((".jpg", ".png")):
            visual_url = resolve_url(visual_url, WGER_MEDIA_BASE_URL)
        elif visual_url.endswith(".gif"):
            visual_url = resolve_url(visual_url, EXERCISEDB_GIF_BASE_URL)

    visual_type = infer_visual_type(visual_url)
    body_part = str(first_present(row, ("bodyPart", "body_part", "category")) or "") or None
    movement_pattern = infer_movement_pattern(body_part, str(row.get("category") or ""))

    instruction_sources: list[InstructionSource] = []
    if steps or description:
        instruction_sources.append(
            InstructionSource(source=source, file=file_path, steps=steps, description=description)
        )

    session_name = name
    if pillar == "spirit" and sanskrit:
        session_name = f"{name} ({str(sanskrit).strip()})"

    record = CatalogRecord(
        slug=slug,
        name=name,
        pillar=pillar,
        target_muscles=target,
        secondary_muscles=secondary,
        equipment=equipment,
        instruction_sources=instruction_sources,
        visual_asset_url=visual_url,
        visual_asset_type=visual_type,
        visual_score=score_visual(visual_url, visual_type),
        movement_pattern=movement_pattern,
        body_part=body_part,
        description=description,
        sanskrit_name=str(sanskrit).strip() if sanskrit else None,
        merge_names={normalize_name(name)},
    )

    if pillar == "spirit":
        record.target_recovery_zones = infer_recovery_zones(name, body_part)
        record.duration_minutes = 5
        record.default_hold_seconds = 45
        record.is_dynamic_flow = "flow" in normalize_name(name) or "cat" in normalize_name(name)

    if pillar == "combat":
        record.sequence = [name]
        record.complexity_level = 3
        record.tactical_focus = "footwork_range"

    return record


def infer_recovery_zones(name: str, body_part: str | None) -> list[str]:
    text = normalize_name(f"{name} {body_part or ''}")
    zones: list[str] = []
    mapping = {
        "hamstring": "hamstrings",
        "hip": "hips",
        "glute": "glutes",
        "back": "lower_back",
        "spine": "thoracic_spine",
        "shoulder": "shoulders",
        "neck": "neck",
        "ankle": "ankles",
        "wrist": "wrists",
    }
    for key, zone in mapping.items():
        if key in text and zone not in zones:
            zones.append(zone)
    return zones or ["lower_back"]


# ---------------------------------------------------------------------------
# Specialized parsers
# ---------------------------------------------------------------------------


def load_wger_bundle(datasets_dir: Path) -> list[CatalogRecord]:
    """Join wger Django fixtures: exercises + English translations + muscles + equipment + images."""
    base = datasets_dir / "wger-master" / "wger" / "exercises" / "fixtures"
    paths = {
        "exercises": base / "exercise-base-data.json",
        "translations": base / "translations.json",
        "muscles": base / "muscles.json",
        "equipment": base / "equipment.json",
        "images": base / "test-exercise-images.json",
    }
    if not paths["exercises"].exists():
        print("[WARN] Wger exercise-base-data.json not found — skipping bundle loader")
        return []

    print("[INFO] Loading Wger fixture bundle…")
    exercises = json.loads(paths["exercises"].read_text(encoding="utf-8"))
    translations = json.loads(paths["translations"].read_text(encoding="utf-8")) if paths["translations"].exists() else []
    muscles_data = json.loads(paths["muscles"].read_text(encoding="utf-8")) if paths["muscles"].exists() else []
    equipment_data = json.loads(paths["equipment"].read_text(encoding="utf-8")) if paths["equipment"].exists() else []

    muscle_map: dict[int, str] = {}
    for item in muscles_data:
        if item.get("model") != "exercises.muscle":
            continue
        fields = item.get("fields", {})
        label = fields.get("name_en") or fields.get("name") or ""
        muscle_map[item["pk"]] = normalize_muscle(str(label))

    equipment_map: dict[int, str] = {}
    for item in equipment_data:
        if item.get("model") != "exercises.equipment":
            continue
        equipment_map[item["pk"]] = map_equipment_tag(item["fields"]["name"])

    translation_by_exercise: dict[int, dict[str, Any]] = {}
    for item in translations:
        if item.get("model") != "exercises.translation":
            continue
        fields = item.get("fields", {})
        exercise_id = fields.get("exercise")
        if exercise_id is None:
            continue
        lang = fields.get("language")
        existing = translation_by_exercise.get(exercise_id)
        if existing is None or lang == WGER_ENGLISH_LANGUAGE_ID:
            if lang == WGER_ENGLISH_LANGUAGE_ID or existing is None:
                translation_by_exercise[exercise_id] = fields

    image_by_exercise: dict[int, str] = {}
    if paths["images"].exists():
        images = json.loads(paths["images"].read_text(encoding="utf-8"))
        for item in images:
            if item.get("model") != "exercises.exerciseimage":
                continue
            fields = item.get("fields", {})
            ex_id = fields.get("exercise")
            if ex_id is None:
                continue
            if fields.get("is_main") or ex_id not in image_by_exercise:
                image_by_exercise[ex_id] = resolve_url(fields.get("image"), WGER_MEDIA_BASE_URL) or ""

    records: list[CatalogRecord] = []
    for item in progress_iter(exercises, "Wger exercises", len(exercises)):
        if item.get("model") != "exercises.exercise":
            continue
        pk = item["pk"]
        fields = item.get("fields", {})
        translation = translation_by_exercise.get(pk)
        if not translation:
            continue

        name = str(translation.get("name") or "").strip()
        if not name:
            continue

        primary = [muscle_map[mid] for mid in fields.get("muscles", []) if mid in muscle_map]
        secondary = [muscle_map[mid] for mid in fields.get("muscles_secondary", []) if mid in muscle_map]
        equipment = [equipment_map[eid] for eid in fields.get("equipment", []) if eid in equipment_map]

        desc_html = translation.get("description_source") or translation.get("description") or ""
        description = strip_html(str(desc_html))
        steps = parse_instruction_steps(description)

        row = {
            "name": name,
            "description": description,
            "instructions": steps,
            "target_muscles": primary,
            "secondary_muscles": secondary,
            "equipment": equipment,
            "visual_asset_url": image_by_exercise.get(pk),
            "_file_hint": "wger",
        }
        record = row_to_partial_record(row, source="wger", file_path=str(paths["exercises"]))
        if record:
            records.append(record)

    print(f"[OK] Wger bundle produced {len(records)} iron records")
    return records


def parse_yoga_poses_file(path: Path) -> list[CatalogRecord]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    poses = payload.get("Poses", payload) if isinstance(payload, dict) else payload
    if not isinstance(poses, list):
        return []

    records: list[CatalogRecord] = []
    for pose in poses:
        if not isinstance(pose, dict):
            continue
        row = {
            "english_name": pose.get("english_name"),
            "sanskrit_name": pose.get("sanskrit_name"),
            "img_url": pose.get("img_url"),
            "pillar": "spirit",
            "_file_hint": "yoga",
        }
        record = row_to_partial_record(row, source="yoga", file_path=str(path))
        if record:
            records.append(record)
    return records


def parse_django_fixture_file(path: Path) -> list[CatalogRecord]:
    """Generic Django fixture ingestion (non-wger-bundle)."""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[WARN] JSON parse failed {path}: {exc}")
        return []

    if not isinstance(payload, list):
        return []

    records: list[CatalogRecord] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        model = item.get("model", "")
        fields = item.get("fields", {})
        if not fields:
            continue

        if model == "exercises.translation":
            continue  # handled by wger bundle
        if model == "exercises.exercise":
            row = dict(fields)
            row["name"] = fields.get("name")
            record = row_to_partial_record(row, source="wger-fixture", file_path=str(path))
            if record:
                records.append(record)
            continue

        if model in {"exercises.exerciseimage", "exercises.exercisevideo"}:
            continue

        if model.startswith("exercises."):
            row = dict(fields)
            row["name"] = fields.get("name") or fields.get("name_en")
            record = row_to_partial_record(row, source=model, file_path=str(path))
            if record:
                records.append(record)

    return records


def parse_csv_file(path: Path) -> list[CatalogRecord]:
    try:
        df = pd.read_csv(path, encoding="utf-8-sig", low_memory=False)
    except Exception as exc:
        print(f"[WARN] CSV read failed {path}: {exc}")
        return []

    records: list[CatalogRecord] = []
    rows = df.to_dict(orient="records")
    for row in progress_iter(rows, f"CSV {path.name}", len(rows)):
        record = row_to_partial_record(row, source="exercisedb-csv", file_path=str(path))
        if record:
            records.append(record)
    return records


def parse_json_file(path: Path) -> list[CatalogRecord]:
    path_str = str(path).replace("\\", "/").lower()
    if path.name.lower() in {"poses.json"} or "pose" in path.name.lower():
        try:
            return parse_yoga_poses_file(path)
        except Exception as exc:
            print(f"[WARN] Yoga parse failed {path}: {exc}")
            return []

    if "exercise-base-data.json" in path_str:
        return []  # handled by bundle loader

    if "translations.json" in path_str:
        return []

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[WARN] JSON read failed {path}: {exc}")
        return []

    # Django fixture?
    if isinstance(payload, list) and payload and isinstance(payload[0], dict) and "model" in payload[0]:
        return parse_django_fixture_file(path)

    records: list[CatalogRecord] = []
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = None
        for key in ("exercises", "data", "results", "items", "Poses", "poses"):
            if isinstance(payload.get(key), list):
                items = payload[key]
                break
        if items is None:
            items = [payload]
    else:
        return []

    for item in items:
        if not isinstance(item, dict):
            continue
        record = row_to_partial_record(item, source="json", file_path=str(path))
        if record:
            records.append(record)
    return records


def parse_xml_file(path: Path) -> list[CatalogRecord]:
    records: list[CatalogRecord] = []
    try:
        tree = ET.parse(path)
        root = tree.getroot()
    except Exception as exc:
        print(f"[WARN] XML parse failed {path}: {exc}")
        return records

    for elem in root.iter():
        if elem.tag.lower() not in {"exercise", "pose", "item", "record"}:
            continue
        row: dict[str, Any] = dict(elem.attrib)
        for child in elem:
            tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
            row[tag] = (child.text or "").strip()
        record = row_to_partial_record(row, source="xml", file_path=str(path))
        if record:
            records.append(record)
    return records


def parse_file(path: Path) -> list[CatalogRecord]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return parse_csv_file(path)
    if suffix == ".json":
        return parse_json_file(path)
    if suffix == ".xml":
        return parse_xml_file(path)
    return []


# ---------------------------------------------------------------------------
# Deduplication & merge
# ---------------------------------------------------------------------------


def merge_records(records: Iterable[CatalogRecord]) -> dict[str, CatalogRecord]:
    """Merge by slug; collapse normalized name duplicates."""
    by_slug: dict[str, CatalogRecord] = {}
    name_index: dict[str, str] = {}

    for record in progress_iter(list(records), "Merging duplicates"):
        norm = record.normalized_name()
        if norm in name_index:
            record.slug = name_index[norm]

        existing = by_slug.get(record.slug)
        if existing is None:
            record.merge_names.add(norm)
            by_slug[record.slug] = record
            name_index[norm] = record.slug
            continue

        merge_into(existing, record)
        name_index[norm] = existing.slug

    return by_slug


def merge_into(target: CatalogRecord, incoming: CatalogRecord) -> None:
    target.merge_names.update(incoming.merge_names)

    if len(incoming.name) > len(target.name):
        target.name = incoming.name

    for muscle in incoming.target_muscles:
        if muscle and muscle not in target.target_muscles:
            target.target_muscles.append(muscle)

    for muscle in incoming.secondary_muscles:
        if muscle and muscle not in target.secondary_muscles:
            target.secondary_muscles.append(muscle)

    for eq in incoming.equipment:
        if eq and eq not in target.equipment:
            target.equipment.append(eq)

    if incoming.visual_score > target.visual_score:
        target.visual_asset_url = incoming.visual_asset_url
        target.visual_asset_type = incoming.visual_asset_type
        target.visual_score = incoming.visual_score

    if not target.description and incoming.description:
        target.description = incoming.description

    if not target.movement_pattern and incoming.movement_pattern:
        target.movement_pattern = incoming.movement_pattern

    if not target.body_part and incoming.body_part:
        target.body_part = incoming.body_part

    if incoming.sanskrit_name and not target.sanskrit_name:
        target.sanskrit_name = incoming.sanskrit_name

    # Prefer spirit/combat specificity when merging
    if incoming.pillar == "spirit" or (incoming.pillar == "combat" and target.pillar == "iron"):
        target.pillar = incoming.pillar

    for src in incoming.instruction_sources:
        if not any(s.source == src.source and s.file == src.file for s in target.instruction_sources):
            target.instruction_sources.append(src)


def map_merged_steps_to_phase_keys(steps: list[str]) -> dict[str, str]:
    """Map ordered instruction steps into Iron Command Center phase keys."""
    cleaned = [str(step).strip() for step in steps if step and str(step).strip()]
    if not cleaned:
        return {}

    count = len(cleaned)
    phases: dict[str, str] = {}

    if count == 1:
        phases["setup"] = cleaned[0]
    elif count == 2:
        phases["setup"] = cleaned[0]
        phases["concentric"] = cleaned[1]
    elif count == 3:
        phases["setup"] = cleaned[0]
        phases["eccentric"] = cleaned[1]
        phases["concentric"] = cleaned[2]
    elif count == 4:
        phases["setup"] = cleaned[0]
        phases["eccentric"] = cleaned[1]
        phases["concentric"] = cleaned[2]
        phases["safety"] = cleaned[3]
    elif count == 5:
        phases["setup"] = cleaned[0]
        phases["eccentric"] = cleaned[1]
        phases["concentric"] = cleaned[2]
        phases["regression"] = cleaned[3]
        phases["safety"] = cleaned[4]
    else:
        phases["setup"] = cleaned[0]
        phases["eccentric"] = cleaned[1]
        middle = cleaned[2:-2]
        phases["concentric"] = " · ".join(middle) if len(middle) > 1 else middle[0]
        phases["regression"] = cleaned[-2]
        phases["safety"] = cleaned[-1]

    return phases


def build_instructions_jsonb(record: CatalogRecord) -> dict[str, Any]:
    all_steps: list[str] = []
    sources_payload: list[dict[str, Any]] = []

    for src in record.instruction_sources:
        entry: dict[str, Any] = {"source": src.source, "file": src.file}
        if src.steps:
            entry["steps"] = src.steps
            for step in src.steps:
                if step not in all_steps:
                    all_steps.append(step)
        if src.description:
            entry["description"] = src.description
        sources_payload.append(entry)

    payload: dict[str, Any] = {
        "merged_steps": all_steps,
        "sources": sources_payload,
    }
    if record.description:
        payload["summary"] = record.description

    phase_keys = map_merged_steps_to_phase_keys(all_steps)
    payload.update(phase_keys)

    # Compact fallback when steps exist but could not be mapped (should not happen)
    if all_steps and not phase_keys:
        payload["cues"] = " ".join(all_steps[:6])

    return payload


def estimate_cns(record: CatalogRecord) -> int:
    if record.pillar != "iron":
        return 2
    text = normalize_name(" ".join(record.equipment + record.target_muscles + [record.name]))
    if "barbell" in text and any(k in text for k in ("squat", "deadlift", "row")):
        return 5
    if "squat" in text or "deadlift" in text:
        return 4
    if record.movement_pattern == "isolation":
        return 1
    return 3


# ---------------------------------------------------------------------------
# SQL generation (batched)
# ---------------------------------------------------------------------------


def migration_header() -> str:
    return "\n".join(
        [
            "-- SOMMA Global Encyclopedia Catalog Seed",
            "-- Generated by scripts/import_catalog.py (massive ingestion)",
            "-- Safe to re-run: ON CONFLICT (slug) DO UPDATE",
            "",
            "alter table public.library_exercises drop constraint if exists library_exercises_visual_asset_type_check;",
            "alter table public.library_combat drop constraint if exists library_combat_visual_asset_type_check;",
            "alter table public.library_flow_spirit drop constraint if exists library_flow_spirit_visual_asset_type_check;",
            "",
            "alter table public.library_exercises",
            "  add constraint library_exercises_visual_asset_type_check",
            "  check (visual_asset_type is null or visual_asset_type in ('lottie', 'svg', 'mp4', 'webm', 'gif', 'webp'));",
            "",
            "alter table public.library_combat",
            "  add constraint library_combat_visual_asset_type_check",
            "  check (visual_asset_type is null or visual_asset_type in ('lottie', 'svg', 'mp4', 'webm', 'gif', 'webp'));",
            "",
            "alter table public.library_flow_spirit",
            "  add constraint library_flow_spirit_visual_asset_type_check",
            "  check (visual_asset_type is null or visual_asset_type in ('lottie', 'svg', 'mp4', 'webm', 'gif', 'webp'));",
            "",
        ]
    )


def chunk_rows(rows: list[str], size: int) -> list[list[str]]:
    return [rows[i : i + size] for i in range(0, len(rows), size)]


def write_batched_inserts(
    lines: list[str],
    *,
    table: str,
    columns: list[str],
    value_rows: list[str],
    batch_size: int,
    conflict_sql: str,
) -> None:
    if not value_rows:
        lines.append(f"-- No rows for {table}")
        lines.append("")
        return

    columns_sql = ",\n  ".join(columns)
    batches = chunk_rows(value_rows, batch_size)
    for batch_index, batch in enumerate(batches, start=1):
        lines.append(f"-- {table} batch {batch_index}/{len(batches)} ({len(batch)} rows)")
        lines.append(f"insert into public.{table} (")
        lines.append(f"  {columns_sql}")
        lines.append(") values")
        lines.append(",\n".join(batch))
        lines.append(conflict_sql)
        lines.append("")


def iron_value_rows(records: list[CatalogRecord]) -> list[str]:
    rows: list[str] = []
    for record in records:
        bio = build_instructions_jsonb(record)
        primary = record.target_muscles[0] if record.target_muscles else "general"
        synergists = record.secondary_muscles
        equipment = sorted(set(record.equipment))
        if equipment and "full_gym" not in equipment and any(e in equipment for e in ("barbell", "cable", "dumbbells")):
            equipment.append("full_gym")
        pattern = record.movement_pattern or infer_movement_pattern(record.body_part, None) or "isolation"
        cns = estimate_cns(record)

        rows.append(
            "  (\n"
            f"    '{stable_id(record.slug)}'::uuid,\n"
            f"    {sql_literal(record.slug)},\n"
            f"    {sql_literal(record.name)},\n"
            f"    '{sql_escape(json.dumps(bio, ensure_ascii=False))}'::jsonb,\n"
            f"    {sql_array(equipment)},\n"
            f"    4,\n"
            f"    8,\n"
            f"    {sql_literal(pattern)},\n"
            f"    {sql_literal(primary)},\n"
            f"    {sql_array(synergists)},\n"
            f"    {cns},\n"
            f"    'low_impact',\n"
            f"    false,\n"
            f"    {sql_literal(record.visual_asset_url)},\n"
            f"    {sql_literal(record.visual_asset_type)}\n"
            "  )"
        )
    return rows


def combat_value_rows(records: list[CatalogRecord]) -> list[str]:
    rows: list[str] = []
    for record in records:
        sequence = record.sequence or [record.name]
        sequence_json = json.dumps(sequence, ensure_ascii=False)
        rows.append(
            "  (\n"
            f"    '{stable_id(record.slug)}'::uuid,\n"
            f"    {sql_literal(record.slug)},\n"
            f"    {sql_literal(record.name)},\n"
            f"    '{sql_escape(sequence_json)}'::jsonb,\n"
            f"    {record.complexity_level or 3},\n"
            f"    {sql_literal(record.tactical_focus or 'footwork_range')},\n"
            f"    {sql_literal(record.visual_asset_url)},\n"
            f"    {sql_literal(record.visual_asset_type)}\n"
            "  )"
        )
    return rows


def spirit_value_rows(records: list[CatalogRecord]) -> list[str]:
    rows: list[str] = []
    for record in records:
        tempo = {
            "type": "dynamic_reps" if record.is_dynamic_flow else "static_hold",
            "breath": "nasal",
            "available_time_min": 3,
            "available_time_max": max(record.duration_minutes + 5, 10),
        }
        if record.is_dynamic_flow:
            tempo["reps"] = 10
            tempo["breath_linked"] = True

        description = record.description
        if not description and record.instruction_sources:
            description = record.instruction_sources[0].description
        if not description:
            description = f"Restorative {record.name} — SOMMA Flow catalog."

        pillar = "spirit" if "savasana" in record.slug or "corpse" in record.normalized_name() else "flow"

        rows.append(
            "  (\n"
            f"    '{stable_id(record.slug)}'::uuid,\n"
            f"    {sql_literal(record.slug)},\n"
            f"    {sql_literal(pillar)},\n"
            f"    {sql_literal(f'{record.name} ({record.sanskrit_name})' if record.sanskrit_name else record.name)},\n"
            f"    {sql_literal(description)},\n"
            f"    {record.duration_minutes},\n"
            f"    '{sql_escape(json.dumps(tempo, ensure_ascii=False))}'::jsonb,\n"
            f"    {record.complexity_level or 2},\n"
            f"    {sql_array(record.target_recovery_zones or infer_recovery_zones(record.name, record.body_part))},\n"
            f"    {record.complexity_tier},\n"
            f"    {'true' if record.is_dynamic_flow else 'false'},\n"
            f"    {record.default_hold_seconds},\n"
            f"    {sql_literal(record.visual_asset_url)},\n"
            f"    {sql_literal(record.visual_asset_type)}\n"
            "  )"
        )
    return rows


def render_sql(
    merged: dict[str, CatalogRecord],
    *,
    batch_size: int,
) -> str:
    iron = [r for r in merged.values() if r.pillar == "iron"]
    combat = [r for r in merged.values() if r.pillar == "combat"]
    spirit = [r for r in merged.values() if r.pillar == "spirit"]

    iron.sort(key=lambda r: r.name.lower())
    combat.sort(key=lambda r: r.name.lower())
    spirit.sort(key=lambda r: r.name.lower())

    lines: list[str] = [migration_header()]

    write_batched_inserts(
        lines,
        table="library_exercises",
        columns=[
            "id",
            "slug",
            "name",
            "biomechanical_instructions",
            "equipment_required",
            "default_sets",
            "default_reps",
            "movement_pattern",
            "primary_muscle",
            "synergist_muscles",
            "cns_fatigue_cost",
            "joint_stress_profile",
            "stretch_mediated_hypertrophy",
            "visual_asset_url",
            "visual_asset_type",
        ],
        value_rows=iron_value_rows(iron),
        batch_size=batch_size,
        conflict_sql=(
            "on conflict (slug) do update set\n"
            "  name = excluded.name,\n"
            "  biomechanical_instructions = excluded.biomechanical_instructions,\n"
            "  equipment_required = excluded.equipment_required,\n"
            "  default_sets = excluded.default_sets,\n"
            "  default_reps = excluded.default_reps,\n"
            "  movement_pattern = excluded.movement_pattern,\n"
            "  primary_muscle = excluded.primary_muscle,\n"
            "  synergist_muscles = excluded.synergist_muscles,\n"
            "  cns_fatigue_cost = excluded.cns_fatigue_cost,\n"
            "  visual_asset_url = excluded.visual_asset_url,\n"
            "  visual_asset_type = excluded.visual_asset_type;"
        ),
    )

    write_batched_inserts(
        lines,
        table="library_combat",
        columns=[
            "id",
            "slug",
            "combo_name",
            "sequence",
            "complexity_level",
            "tactical_focus",
            "visual_asset_url",
            "visual_asset_type",
        ],
        value_rows=combat_value_rows(combat),
        batch_size=batch_size,
        conflict_sql=(
            "on conflict (slug) do update set\n"
            "  combo_name = excluded.combo_name,\n"
            "  sequence = excluded.sequence,\n"
            "  complexity_level = excluded.complexity_level,\n"
            "  tactical_focus = excluded.tactical_focus,\n"
            "  visual_asset_url = excluded.visual_asset_url,\n"
            "  visual_asset_type = excluded.visual_asset_type;"
        ),
    )

    write_batched_inserts(
        lines,
        table="library_flow_spirit",
        columns=[
            "id",
            "slug",
            "pillar",
            "session_name",
            "description",
            "duration_minutes",
            "tempo_profile",
            "complexity_level",
            "target_recovery_zones",
            "complexity_tier",
            "is_dynamic_flow",
            "default_hold_seconds",
            "visual_asset_url",
            "visual_asset_type",
        ],
        value_rows=spirit_value_rows(spirit),
        batch_size=batch_size,
        conflict_sql=(
            "on conflict (slug) do update set\n"
            "  session_name = excluded.session_name,\n"
            "  description = excluded.description,\n"
            "  duration_minutes = excluded.duration_minutes,\n"
            "  tempo_profile = excluded.tempo_profile,\n"
            "  complexity_level = excluded.complexity_level,\n"
            "  target_recovery_zones = excluded.target_recovery_zones,\n"
            "  complexity_tier = excluded.complexity_tier,\n"
            "  is_dynamic_flow = excluded.is_dynamic_flow,\n"
            "  default_hold_seconds = excluded.default_hold_seconds,\n"
            "  visual_asset_url = excluded.visual_asset_url,\n"
            "  visual_asset_type = excluded.visual_asset_type;"
        ),
    )

    lines.append(f"-- Totals: iron={len(iron)}, combat={len(combat)}, spirit={len(spirit)}, unique={len(merged)}")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Optional asset downloader
# ---------------------------------------------------------------------------


def download_assets_local(merged: dict[str, CatalogRecord], repo_root: Path) -> None:
    try:
        import requests  # type: ignore
    except ImportError as exc:
        raise RuntimeError("pip install requests required for DOWNLOAD_ASSETS_LOCAL") from exc

    folders = {
        "iron": repo_root / "assets" / "clips" / "iron",
        "combat": repo_root / "assets" / "clips" / "combat",
        "spirit": repo_root / "assets" / "clips" / "spirit",
    }
    for folder in folders.values():
        folder.mkdir(parents=True, exist_ok=True)

    for record in progress_iter(merged.values(), "Downloading assets"):
        if not record.visual_asset_url or not record.visual_asset_url.startswith("http"):
            continue
        folder = folders.get(record.pillar, folders["iron"])
        ext = record.visual_asset_type or infer_visual_type(record.visual_asset_url) or "gif"
        target = folder / f"{record.slug}.{ext}"
        if target.exists():
            record.visual_asset_url = str(target.as_posix())
            continue
        try:
            response = requests.get(record.visual_asset_url, timeout=45)
            response.raise_for_status()
            target.write_bytes(response.content)
            record.visual_asset_url = str(target.as_posix())
            record.visual_asset_type = infer_visual_type(record.visual_asset_url)
        except Exception as exc:
            print(f"[WARN] Download failed {record.slug}: {exc}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SOMMA global catalog massive ingestion")
    parser.add_argument("--datasets-dir", type=Path, default=DEFAULT_DATASETS_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--download-assets", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    datasets_dir: Path = args.datasets_dir
    output_path: Path = args.output
    batch_size: int = max(50, args.batch_size)
    download_assets = DOWNLOAD_ASSETS_LOCAL or args.download_assets

    print("=" * 72)
    print("SOMMA Global Catalog — Massive Ingestion")
    print(f"  datasets:   {datasets_dir}")
    print(f"  output:     {output_path}")
    print(f"  batch size: {batch_size}")
    print(f"  download:   {download_assets}")
    print("=" * 72)

    if not datasets_dir.exists():
        print(f"[ERROR] datasets directory not found: {datasets_dir}")
        return 1

    files = discover_files(datasets_dir)
    print(f"[INFO] Discovered {len(files)} catalog files (.csv/.json/.xml)")

    all_records: list[CatalogRecord] = []

    # Wger bundle first (richest exercise metadata)
    all_records.extend(load_wger_bundle(datasets_dir))

    for path in progress_iter(files, "Parsing files", len(files)):
        path_str = str(path).replace("\\", "/").lower()
        if "exercise-base-data.json" in path_str or path.name == "translations.json":
            continue
        try:
            parsed = parse_file(path)
            all_records.extend(parsed)
            if parsed:
                print(f"[OK] {path.relative_to(datasets_dir)} -> {len(parsed)} records")
        except Exception as exc:
            print(f"[ERROR] {path}: {exc}")

    print(f"[INFO] Raw records before dedup: {len(all_records)}")
    merged = merge_records(all_records)
    print(f"[INFO] Unique records after dedup: {len(merged)}")

    iron_n = sum(1 for r in merged.values() if r.pillar == "iron")
    combat_n = sum(1 for r in merged.values() if r.pillar == "combat")
    spirit_n = sum(1 for r in merged.values() if r.pillar == "spirit")
    visual_n = sum(1 for r in merged.values() if r.visual_asset_url)

    if download_assets:
        try:
            download_assets_local(merged, REPO_ROOT)
        except Exception as exc:
            print(f"[ERROR] Asset download failed: {exc}")
            return 1

    sql = render_sql(merged, batch_size=batch_size)

    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(sql, encoding="utf-8")
        print(f"[OK] Wrote {output_path} ({len(sql):,} bytes)")
    except Exception as exc:
        print(f"[ERROR] Write failed: {exc}")
        return 1

    print("-" * 72)
    print("Summary")
    print(f"  Files scanned:     {len(files)}")
    print(f"  Unique movements:  {len(merged)}")
    print(f"    Iron:            {iron_n}")
    print(f"    Combat:          {combat_n}")
    print(f"    Spirit:          {spirit_n}")
    print(f"  With visual URL:   {visual_n}")
    print(f"  SQL batches:       ~{(iron_n + combat_n + spirit_n) // batch_size + 3}")

    summary_df = pd.DataFrame(
        [
            {
                "pillar": record.pillar,
                "has_visual": bool(record.visual_asset_url),
                "source_count": len(record.instruction_sources),
            }
            for record in merged.values()
        ]
    )
    if not summary_df.empty:
        grouped = summary_df.groupby("pillar", dropna=False).agg(
            count=("pillar", "size"),
            with_visual=("has_visual", "sum"),
            avg_sources=("source_count", "mean"),
        )
        print("\nPandas rollup by pillar:")
        print(grouped.to_string())
    print("-" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
