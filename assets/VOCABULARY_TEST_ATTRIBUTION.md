# Test vocabulary attribution

`vocabulary-test-v1.json` is a transformed, learner-oriented test dataset distributed under the [Creative Commons Attribution-ShareAlike 4.0 International license](https://creativecommons.org/licenses/by-sa/4.0/).

It is not an official Instituto Cervantes or CEFR vocabulary list, and its tiers must not be interpreted as a complete proficiency assessment.

## Sources

The source snapshot is Jeff Doozan's [`doozan/spanish_data`](https://github.com/doozan/spanish_data) repository at commit `30384d5ab45d072c113bff8807ea59dae1c38d0a` (2026-06-01). That project is published under CC BY 4.0 and documents these upstream sources:

- `es-en.data`: English Wiktionary Spanish lexical data, attributed to [Wiktionary](https://www.wiktionary.org/) under CC BY-SA.
- `frequency.csv`: Spanish frequency data derived from [`hermitdave/FrequencyWords`](https://github.com/hermitdave/FrequencyWords), attributed under CC BY-SA 3.0.
- FreeLing was used upstream for part-of-speech tagging.

No Tatoeba sentences or audio are included in this dataset.

The first 100 records preserve the IDs, displayed words, translations, and topic categories from this project's original placeholder vocabulary.

## Transformations

The build process:

- removes proper names, extraction artifacts, duplicates, unsuitable senses, and a small set of age-inappropriate terms;
- retains one learner-facing sense per Spanish display value;
- shortens dictionary descriptions into compact English choices;
- applies reviewed overrides where a mechanically selected dictionary sense would be misleading;
- preserves the original 100 records in the `foundation` tier;
- fills three 500-entry tiers primarily by lemmatized corpus frequency; and
- adds stable IDs, part of speech, tier, source, and frequency-rank metadata.

The reproducible transformation is in `scripts/build-test-vocabulary.py`. The external source files are intentionally not committed to this repository.
