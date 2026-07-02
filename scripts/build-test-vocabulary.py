#!/usr/bin/env python3
"""Build the versioned 1,500-entry test vocabulary from open source data."""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path


TIERS = ("foundation", "everyday", "expanding")
TIER_SIZE = 500
ALLOWED_POS = {
    "adj": "adjective",
    "adv": "adverb",
    "art": "article",
    "conj": "conjunction",
    "contraction": "contraction",
    "determiner": "determiner",
    "interj": "interjection",
    "n": "noun",
    "num": "numeral",
    "prep": "preposition",
    "pron": "pronoun",
    "v": "verb",
}
DICTIONARY_POS = {
    "adj": "adj",
    "adv": "adv",
    "art": "art",
    "conj": "conj",
    "contraction": "contraction",
    "determiner": "determiner",
    "interj": "interj",
    "n": "n",
    "num": "num",
    "prep": "prep",
    "pron": "pron",
    "v": "v",
}
SOURCE_POS_OVERRIDES = {
    "mi": "determiner",
}

# Corpus frequency is useful but not a curriculum. These entries are unsuitable
# for a general high-school test deck or are frequent extraction artifacts.
EXCLUDED = {
    "coño", "carajo", "joder", "mierda", "puta", "puto", "hostia", "gilipollas",
    "cabrón", "cabrona", "pendejo", "pendeja", "chingar", "verga", "culo", "follar",
    "maricón", "marica", "cojones", "chingada", "pinche", "mamón", "zorra",
    "te",  # The frequency source incorrectly labels this pronoun as a noun.
    "tuya",  # Possessive-token frequency is incorrectly assigned to the plant name.
    "veras",  # Mostly the phrase "de veras"; not useful as an isolated noun card.
    "menudo",  # Mostly "a menudo"; the isolated noun sense is a regional dish.
    "ox",  # A rare interjection promoted by subtitle dialogue.
}

# Compact, learner-facing translations for frequent grammatical words whose
# full dictionary definitions describe usage rather than provide a clean gloss.
GLOSS_OVERRIDES = {
    "a": "to / at",
    "al": "to the",
    "algo": "something",
    "alguno": "some / any",
    "aquel": "that over there",
    "aquí": "here",
    "así": "like this / like that",
    "cada": "each / every",
    "callar": "to be quiet / to silence",
    "como": "as / like",
    "cómo": "how",
    "con": "with",
    "confiar": "to trust / to confide",
    "cuando": "when",
    "cuál": "which / what",
    "de": "of / from",
    "del": "of the / from the",
    "donde": "where",
    "dónde": "where",
    "el": "the (masculine singular)",
    "ella": "she / her",
    "ellos": "they / them",
    "ese": "that",
    "eso": "that",
    "este": "this",
    "esto": "this",
    "haber": "to have / there to be",
    "instituto": "high school / institute",
    "la": "the (feminine singular)",
    "lo": "it / the",
    "más": "more",
    "menos": "less / fewer",
    "mi": "my",
    "mío": "mine",
    "mucho": "much / many",
    "nada": "nothing",
    "ni": "neither / nor",
    "ninguno": "none / not any",
    "noticia": "news",
    "nosotros": "we / us",
    "nuestro": "our / ours",
    "o": "or",
    "otro": "other / another",
    "para": "for / in order to",
    "pero": "but",
    "poco": "little / few",
    "por": "by / for / through",
    "porque": "because",
    "película": "movie / film",
    "personaje": "character",
    "propiedad": "property",
    "qué": "what",
    "que": "that / which / who",
    "quien": "who",
    "quién": "who",
    "se": "himself / herself / itself / themselves",
    "si": "if / whether",
    "sí": "yes",
    "sin": "without",
    "sobre": "on / about",
    "su": "his / her / its / their",
    "suyo": "his / hers / theirs",
    "también": "also / too",
    "todo": "all / everything",
    "tú": "you (informal singular)",
    "tu": "your (informal singular)",
    "tuyo": "yours",
    "uno": "one",
    "usted": "you (formal singular)",
    "ustedes": "you (plural)",
    "ya": "already / now",
    "yo": "I",
    "venir": "to come",
    "acostar": "to put to bed / to lie down",
    "aguantar": "to endure / to put up with",
    "alejar": "to move away",
    "apagar": "to turn off / to extinguish",
    "añadir": "to add",
    "archivo": "file / archive",
    "clase": "class",
    "conjunto": "group / set",
    "cuarto": "room / fourth",
    "curso": "course / class",
    "discurso": "speech / discourse",
    "encantar": "to love / to delight",
    "especialmente": "especially",
    "estupendo": "great / wonderful",
    "fuente": "source / fountain",
    "lengua": "language / tongue",
    "llevar": "to carry / to take / to wear",
    "mínimo": "minimum",
    "nervioso": "nervous",
    "pecho": "chest",
    "principio": "beginning / principle",
    "probar": "to try / to taste / to test",
    "proponer": "to propose / to suggest",
    "quieto": "still / quiet",
    "raro": "strange / unusual",
    "rendir": "to yield / to perform",
    "rechazar": "to reject / to refuse",
    "revisar": "to review / to check",
    "sencillo": "simple / straightforward",
    "viaje": "trip / journey",
}

BAD_GLOSS_MARKERS = (
    "abbreviation of",
    "alternative form",
    "alternative spelling",
    "archaic",
    "dated",
    "form of",
    "inflection of",
    "letter:",
    "misspelling",
    "nonstandard",
    "obsolete",
    "pronunciation spelling",
    "rare spelling",
    "senses relating",
    "surname",
    "typographic",
    "used to express",
)


def parse_dictionary(path: Path) -> dict[str, list[tuple[str, str]]]:
    dictionary: dict[str, list[tuple[str, str]]] = {}
    word = None
    part_of_speech = None

    with path.open(encoding="utf-8") as source:
        for raw_line in source:
            line = raw_line.rstrip("\n")
            if line == "_____":
                word = None
                part_of_speech = None
            elif word is None and line:
                word = line
                dictionary.setdefault(word, [])
            elif line.startswith("pos: "):
                part_of_speech = line[5:]
            elif line.startswith("  gloss: ") and word and part_of_speech:
                dictionary[word].append((part_of_speech, line[9:]))

    return dictionary


def clean_gloss(gloss: str) -> str | None:
    lowered = gloss.casefold()
    if any(marker in lowered for marker in BAD_GLOSS_MARKERS):
        return None

    cleaned = gloss.replace("\u00a0", " ").replace('"', "")
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = re.sub(r"\[[^\[\]]*]", "", cleaned)
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = re.sub(r"\([^()]*\)", "", cleaned)
    cleaned = cleaned.split(";")[0].strip(" .,:—-")
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned or len(cleaned) > 64 or cleaned.startswith("#"):
        return None

    if "," in cleaned:
        pieces = [piece.strip() for piece in cleaned.split(",") if piece.strip()]
        if len(pieces) > 1 and all(len(piece) <= 28 for piece in pieces[:3]):
            cleaned = " / ".join(dict.fromkeys(pieces[:3]))

    return cleaned


def choose_gloss(word: str, source_pos: str, senses: list[tuple[str, str]]) -> str | None:
    if word in GLOSS_OVERRIDES:
        return GLOSS_OVERRIDES[word]

    desired_pos = DICTIONARY_POS[source_pos]
    matching = [sense for sense in senses if sense[0] == desired_pos]
    candidates = matching or senses

    for _, gloss in candidates:
        cleaned = clean_gloss(gloss)
        if cleaned:
            return cleaned

    return None


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.casefold()).strip("-")


def load_frequency(path: Path) -> list[dict[str, str]]:
    records = []
    with path.open(encoding="utf-8", newline="") as source:
        for row in csv.DictReader(source):
            if row["flags"] or row["pos"] not in ALLOWED_POS:
                continue
            word = row["spanish"].strip()
            if word in EXCLUDED:
                continue
            if word != word.lower():
                continue
            if not re.fullmatch(r"[a-záéíóúüñ]+", word, re.IGNORECASE):
                continue
            records.append(row)
    return records


def build_entries(source_dir: Path, current_path: Path) -> list[dict[str, object]]:
    dictionary = parse_dictionary(source_dir / "es-en.data")
    frequency = load_frequency(source_dir / "frequency.csv")
    frequency_rank = {}
    frequency_pos = {}
    for index, row in enumerate(frequency, start=1):
        frequency_rank.setdefault(row["spanish"], index)
        frequency_pos.setdefault(row["spanish"], row["pos"])

    current = json.loads(current_path.read_text(encoding="utf-8"))
    entries: list[dict[str, object]] = []
    used_words = set()
    used_ids = set()

    for item in current:
        word = item["spanish"]
        source_pos = frequency_pos.get(word, "n")
        current_pos = {
            "greetings": "phrase",
            "numbers": "numeral",
            "adjectives": "adjective",
            "verbs": "verb",
        }.get(item["category"], ALLOWED_POS.get(source_pos, "noun"))
        entry = {
            "id": item["id"],
            "spanish": word,
            "english": item["english"],
            "partOfSpeech": current_pos,
            "tier": "foundation",
            "category": item["category"],
            "frequencyRank": frequency_rank.get(word),
            "source": "project-placeholder-v1",
        }
        entries.append(entry)
        used_words.add(word.casefold())
        used_ids.add(item["id"])

    candidates = []
    for rank, row in enumerate(frequency, start=1):
        word = row["spanish"]
        if word.casefold() in used_words:
            continue
        source_pos = SOURCE_POS_OVERRIDES.get(word, row["pos"])
        gloss = choose_gloss(word, source_pos, dictionary.get(word, []))
        if not gloss:
            continue
        candidates.append((rank, row, source_pos, gloss))

    candidate_index = 0
    for tier in TIERS:
        while sum(entry["tier"] == tier for entry in entries) < TIER_SIZE:
            if candidate_index >= len(candidates):
                raise RuntimeError("Not enough suitable candidates to fill all tiers.")
            rank, row, source_pos, gloss = candidates[candidate_index]
            candidate_index += 1
            word = row["spanish"]
            if word.casefold() in used_words:
                continue

            base_id = f"{slugify(word)}--{source_pos}--01"
            entry_id = base_id
            suffix = 2
            while entry_id in used_ids:
                entry_id = f"{base_id}-{suffix}"
                suffix += 1

            entries.append({
                "id": entry_id,
                "spanish": word,
                "english": gloss,
                "partOfSpeech": ALLOWED_POS[source_pos],
                "tier": tier,
                "category": f"grammar-{ALLOWED_POS[source_pos]}",
                "frequencyRank": rank,
                "source": "doozan-spanish-data-2026-06-01",
            })
            used_words.add(word.casefold())
            used_ids.add(entry_id)

    tier_order = {tier: index for index, tier in enumerate(TIERS)}
    return sorted(entries, key=lambda item: (
        tier_order[item["tier"]],
        item["frequencyRank"] is None,
        item["frequencyRank"] or 10**9,
        item["spanish"],
    ))


def validate(entries: list[dict[str, object]]) -> None:
    if len(entries) != TIER_SIZE * len(TIERS):
        raise ValueError(f"Expected 1,500 entries; found {len(entries)}.")
    if len({entry["id"] for entry in entries}) != len(entries):
        raise ValueError("Vocabulary IDs are not unique.")
    if len({str(entry["spanish"]).casefold() for entry in entries}) != len(entries):
        raise ValueError("Spanish display values are not unique.")
    for tier in TIERS:
        count = sum(entry["tier"] == tier for entry in entries)
        if count != TIER_SIZE:
            raise ValueError(f"Expected {TIER_SIZE} {tier} entries; found {count}.")
    for entry in entries:
        for field in ("id", "spanish", "english", "partOfSpeech", "tier", "category", "source"):
            if not entry[field]:
                raise ValueError(f"Entry {entry['id']} has an empty {field} field.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--current", type=Path, default=Path("assets/vocabulary.json"))
    parser.add_argument("--output", type=Path, default=Path("assets/vocabulary-test-v1.json"))
    args = parser.parse_args()

    entries = build_entries(args.source_dir, args.current)
    validate(entries)
    args.output.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(entries)} entries to {args.output}.")


if __name__ == "__main__":
    main()
