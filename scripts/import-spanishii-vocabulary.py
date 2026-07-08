#!/usr/bin/env python3
"""Append the Spanish II workbook vocabulary to the official vocabulary asset.

The import keeps the source teaching text intact, merges exact repeated Spanish
prompts, and labels the original dataset as Year 1 and this continuation as
Year 2.  The app still has only three scheduling tiers, so Year 2 entries are
placed in the existing "expanding" tier until the level model grows another
frontier.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
VOCABULARY_PATH = ROOT / "assets" / "vocabulary-official-v1.json"
METADATA_PATH = ROOT / "assets" / "vocabulary-official-v1.meta.json"
DEFAULT_WORKBOOK = Path("/Users/edgar/Downloads/spanishii/spanishii_vocabulary.xlsx")

YEAR2_SOURCE_ID = "spanishii-vocabulary-2026-07-08"
YEAR2_SOURCE_FILE = "spanishii_vocabulary.xlsx"
YEAR2_SOURCE_SHEET = "Vocabulary"

QUIZ_ENGLISH_OVERRIDES = {
    "tocar un instrumento musical": "to play a musical instrument",
    "en caso de que": "in case",
}

SPANISH_QUIZ_SPLIT_EXCEPTIONS = {
    "el/la",
    "los/las",
}


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip()).lower()


def strip_accents(value: str) -> str:
    replacements = str.maketrans("áéíóúüñÁÉÍÓÚÜÑ", "aeiouunAEIOUUN")
    return value.translate(replacements)


def slugify(value: str) -> str:
    slug = strip_accents(value).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug[:34] or "entry"


def stable_id(spanish: str, english: str) -> str:
    digest = hashlib.sha1(f"{spanish}\0{english}".encode("utf-8")).hexdigest()[:7]
    return f"g2-{slugify(spanish)}-{digest}"


def split_senses(english: str) -> list[str]:
    return [piece.strip() for piece in english.split(";") if piece.strip()]


def remove_parenthetical_grammar(value: str) -> str:
    return re.sub(r"\s*\((?:[eiou]:[ieou]|e:ie|o:ue|e:i|u:ue)\)\s*", " ", value).strip()


def remove_articles(value: str) -> str:
    value = re.sub(r"^(el/la|los/las|el|la|los|las)\s+", "", value, flags=re.I)
    return value.strip()


def first_spanish_alternative(value: str) -> str:
    if "," in value:
        return value.split(",", 1)[0].strip()
    if "/" in value and not any(marker in normalized(value) for marker in SPANISH_QUIZ_SPLIT_EXCEPTIONS):
        return value.split("/", 1)[0].strip()
    return value


def lemma_from_spanish(spanish: str) -> str:
    value = first_spanish_alternative(spanish)
    value = remove_parenthetical_grammar(value)
    value = remove_articles(value)
    value = re.sub(r"\s*\([^)]*\)\s*", " ", value)
    value = value.replace("…", "").strip()
    value = re.sub(r"\s+", " ", value)
    value = value.replace("/a", "").replace("(a)", "")
    return value.strip(" .")


def grammar_from_spanish(spanish: str) -> dict[str, object]:
    grammar: dict[str, object] = {}
    stem_change = re.search(r"\((e:ie|o:ue|e:i|u:ue)\)", spanish)
    if stem_change:
        grammar["stemChange"] = stem_change.group(1)
    if re.search(r"(^|\s)[a-záéíóúüñ]+se\b", remove_parenthetical_grammar(spanish), re.I):
        grammar["reflexive"] = True
    if any(marker in spanish for marker in ["/a", "(a)", "el/la", "el actor, la actriz"]):
        grammar["genderVariant"] = True
    if "," in spanish or "/" in spanish:
        grammar["sourceAlternatives"] = True
    return grammar


def is_bare_infinitive(spanish: str) -> bool:
    value = remove_parenthetical_grammar(spanish).strip().lower()
    return bool(re.fullmatch(r"[a-záéíóúüñ]+(?:se)?", value)) and value.replace("se", "").endswith(
        ("ar", "er", "ir")
    )


def infer_part_of_speech(row: dict[str, str]) -> str:
    spanish = row["spanish"].strip()
    english = row["english"].strip().lower()
    category = row["category"].strip()
    category_lower = category.lower()
    spanish_lower = spanish.lower()

    if category_lower == "conjunciones":
        return "conjunction"
    if category_lower == "adverbios":
        return "adverb"
    if category_lower == "adjetivos":
        return "adjective"
    if spanish_lower.startswith(("es ", "es...", "ojalá", "no cabe duda", "no hay duda", "no es ")):
        return "phrase"
    if category_lower == "otras palabras y expresiones":
        return "phrase"
    if re.match(r"^(el/la|los/las|el|la|los|las)\b", spanish, flags=re.I):
        return "noun"
    if spanish_lower.startswith("de ") and category_lower == "el cine y la televisión":
        return "adjective"
    if spanish_lower in {"dentro de diez años", "en el futuro", "en exceso"}:
        return "adverb"
    if english.startswith(("to ", "not to ")) or is_bare_infinitive(spanish):
        if is_bare_infinitive(spanish):
            return "verb"
        return "verb expression"
    if "/a" in spanish or "(a)" in spanish:
        return "adjective"
    return "phrase"


def source_reference(excel_row: int) -> dict[str, object]:
    return {
        "source": YEAR2_SOURCE_ID,
        "sourceFile": YEAR2_SOURCE_FILE,
        "sourceSheet": YEAR2_SOURCE_SHEET,
        "sourceRow": excel_row,
    }


def merge_entry(existing: dict[str, object], row: dict[str, str], excel_row: int) -> None:
    chapter = int(row["chapter"])
    english = row["english"].strip()
    category = row["category"].strip()
    existing["chapters"] = sorted(set([*existing.get("chapters", []), chapter]))
    existing["years"] = sorted(set([*existing.get("years", [existing.get("year", 1)]), 2]))
    existing["year"] = min(existing["years"])
    existing.setdefault("sourceReferences", [])
    existing["sourceReferences"].append(source_reference(excel_row))
    existing.setdefault("sourceCategories", [])
    if category not in existing["sourceCategories"]:
        existing["sourceCategories"].append(category)
    senses = list(existing.get("senses", []))
    for sense in split_senses(english):
        if sense not in senses:
            senses.append(sense)
    existing["senses"] = senses
    if english not in existing.get("english", ""):
        existing["english"] = "; ".join(senses)


def new_entry(row: dict[str, str], excel_row: int, curriculum_rank: int) -> dict[str, object]:
    spanish = row["spanish"].strip()
    english = row["english"].strip()
    chapter = int(row["chapter"])
    entry: dict[str, object] = {
        "id": stable_id(spanish, english),
        "spanish": spanish,
        "english": english,
        "lemma": lemma_from_spanish(spanish),
        "partOfSpeech": infer_part_of_speech(row),
        "tier": "expanding",
        "year": 2,
        "years": [2],
        "chapter": chapter,
        "chapters": [chapter],
        "category": row["category"].strip(),
        "senses": split_senses(english),
        "source": YEAR2_SOURCE_ID,
        "sourceRows": [excel_row],
        "sourceReferences": [source_reference(excel_row)],
        "curriculumRank": curriculum_rank,
    }
    grammar = grammar_from_spanish(spanish)
    if grammar:
        entry["grammar"] = grammar
    quiz_spanish = first_spanish_alternative(spanish)
    if quiz_spanish != spanish:
        entry["quizSpanish"] = quiz_spanish
    quiz_english = QUIZ_ENGLISH_OVERRIDES.get(normalized(spanish))
    if quiz_english:
        entry["quizEnglish"] = quiz_english
    return entry


def main() -> None:
    workbook = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_WORKBOOK
    vocabulary = json.loads(VOCABULARY_PATH.read_text())
    metadata = json.loads(METADATA_PATH.read_text())

    if any(entry.get("year") == 2 or 2 in entry.get("years", []) for entry in vocabulary):
        raise SystemExit("Spanish II vocabulary appears to be imported already.")

    for entry in vocabulary:
        entry["year"] = 1
        entry["years"] = [1]

    rows = pd.read_excel(workbook, sheet_name=YEAR2_SOURCE_SHEET, dtype=str).fillna("")
    by_exact_spanish = {normalized(entry["spanish"]): entry for entry in vocabulary}
    internal_merges = 0
    existing_merges = 0

    next_rank = max(entry.get("curriculumRank", 0) for entry in vocabulary) + 1
    for index, pandas_row in rows.iterrows():
        row = {key: str(value).strip() for key, value in pandas_row.to_dict().items()}
        excel_row = index + 2
        key = normalized(row["spanish"])
        if key in by_exact_spanish:
            before_years = set(by_exact_spanish[key].get("years", []))
            merge_entry(by_exact_spanish[key], row, excel_row)
            if 1 in before_years:
                existing_merges += 1
            else:
                internal_merges += 1
            continue
        entry = new_entry(row, excel_row, next_rank)
        next_rank += 1
        vocabulary.append(entry)
        by_exact_spanish[key] = entry

    vocabulary.sort(key=lambda entry: entry.get("curriculumRank", 0))

    tier_counts = {
        tier: sum(1 for entry in vocabulary if entry["tier"] == tier)
        for tier in ["foundation", "everyday", "expanding"]
    }
    year1_count = sum(1 for entry in vocabulary if 1 in entry.get("years", []))
    year2_prompt_count = len({normalized(row["spanish"]) for _, row in rows.iterrows()})
    year2_entry_count = sum(1 for entry in vocabulary if entry.get("year") == 2)
    repeated_from_year1 = sum(1 for entry in vocabulary if entry.get("year") == 1 and 2 in entry.get("years", []))

    metadata["entryCount"] = len(vocabulary)
    metadata["source"] = {
        "id": "combined-official-curriculum-2026-07-08",
        "description": "Project-provided high-school Spanish curriculum workbooks for Year 1 and Spanish II.",
        "sources": [
            {
                "id": "vocab-for-g-2026-07-02",
                "sourceFile": "Vocab for G.xlsx",
                "sourceSheet": "Sheet1",
                "sourceRowCount": 1078,
            },
            {
                "id": YEAR2_SOURCE_ID,
                "sourceFile": YEAR2_SOURCE_FILE,
                "sourceSheet": YEAR2_SOURCE_SHEET,
                "sourceRowCount": len(rows),
                "chapterRange": [10, 18],
                "reviewNotes": "Workbook review notes flag chapters 15 and 18 for proofread attention; no obvious OCR errors were found in the focused intake pass.",
            },
        ],
        "rightsStatus": "Project-provided source material; provenance documentation remains to be finalized.",
    }
    metadata["tiers"] = [
        {"id": "foundation", "entryCount": tier_counts["foundation"], "chapters": [0, 1, 2]},
        {"id": "everyday", "entryCount": tier_counts["everyday"], "chapters": [3, 4, 5, 6]},
        {
            "id": "expanding",
            "entryCount": tier_counts["expanding"],
            "chapters": list(range(7, 19)),
        },
    ]
    metadata["years"] = [
        {
            "id": 1,
            "label": "Year 1",
            "entryCount": year1_count,
            "firstIntroductionChapters": list(range(0, 10)),
        },
        {
            "id": 2,
            "label": "Year 2",
            "sourceRowCount": len(rows),
            "sourcePromptCount": year2_prompt_count,
            "newEntryCount": year2_entry_count,
            "repeatedYear1EntryCount": repeated_from_year1,
            "firstIntroductionChapters": list(range(10, 19)),
        },
    ]
    metadata["transformation"]["spanishIIImport"] = {
        "sourceRows": len(rows),
        "uniqueSourcePrompts": year2_prompt_count,
        "newEntries": year2_entry_count,
        "mergedIntoYear1Entries": repeated_from_year1,
        "internalDuplicateRowsMerged": internal_merges,
        "existingDuplicateRowsMerged": existing_merges,
        "quizEnglishOverrides": sorted(QUIZ_ENGLISH_OVERRIDES),
        "tierAssignment": "Year 2 entries are assigned to the existing expanding tier pending a future level-model refactor.",
    }
    metadata["transformation"]["entriesWithStructuredGrammar"] = sum(
        1 for entry in vocabulary if entry.get("grammar")
    )

    notes = metadata.setdefault("notes", [])
    for note in [
        "Every entry has a year label; repeated prompts can carry multiple years while retaining the year of first introduction.",
        "Spanish II chapters 10–18 are currently assigned to the existing Expanding application tier.",
        "The source's official Spanish-English teaching text is preserved except for quiz-only overrides used to remove misleading production prompts.",
    ]:
        if note not in notes:
            notes.append(note)

    VOCABULARY_PATH.write_text(json.dumps(vocabulary, ensure_ascii=False, indent=2) + "\n")
    METADATA_PATH.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(
        f"Imported {len(rows)} rows as {year2_prompt_count} Year 2 prompts: "
        f"{year2_entry_count} new entries, {repeated_from_year1} repeated Year 1 entries."
    )


if __name__ == "__main__":
    main()
