# Sources and content provenance

## What was used, and how

This app's **structure and skill taxonomy** were informed by the publicly documented shape of current UK 11+ assessments, with particular attention to North London selective schools. The types of material consulted were:

- **London 11+ Consortium published information** on its assessment format — the subject list (Maths, English, Verbal Reasoning, Non-Verbal Reasoning, problem solving, creative comprehension), which sections are adaptive (Maths, VR, NVR) and which are not (English, problem solving, creative comprehension), and the stated scope of each: Maths based on the Year 5 National Curriculum with additional challenge; English covering fiction comprehension plus standard English, spelling and grammar; VR covering vocabulary, language, pattern recognition and critical thinking.
- **The English National Curriculum programmes of study** for Year 5 mathematics and for English (reading comprehension, grammar, punctuation and spelling), used to set the topic list and the boundary of what is reasonable to ask.
- **Publicly available familiarisation and sample material** of the kind that assessment providers and schools publish freely for candidates, used to understand conventional *formats* — for example how verbal reasoning question families are typically presented (synonyms, antonyms, odd one out, analogies, letter sequences, letter codes, hidden words, compound words), and the general style, length and register of multiple-choice stems at this level.
- **General knowledge of GL Assessment-style question formats**, again at the level of format and question family rather than specific content.

## What was deliberately not done

- **No past-paper question has been copied, adapted or paraphrased.** Every question, every passage and every explanation in this repository is original writing produced for this project.
- **No commercial paper has been scraped or reproduced**, in whole or in part.
- **No paywalled or restricted material was accessed or circumvented.** Where content could not be legally accessed, it simply was not used.
- **No school, consortium, publisher or examination board is claimed as a source, partner or endorser.**

The comprehension passages in `src/data/passages.json` — `The Keeper's Daughter`, `Saturday at the Market`, `The Causeway`, `The New Girl`, `The Sunflower Contest`, `Mooring at Dusk`, `The Birds That Almost Never Land` and `Why the Local Library Still Matters` — are original writing produced for this app. The last two are non-fiction and argument; the rest are short fiction.

## Generated questions

`src/data/generated.json` holds questions expanded from the parameterised templates in `src/data/templates.ts` (see [docs/question-format.md](docs/question-format.md)). The templates are original code written for this project: the wording, the number ranges and the misconception each distractor represents were all authored here. No generated question is derived from any external item bank, and no external service is involved — expansion is a local build step.

## What this app is and is not

This is an independent revision aid. It is **not** a mock exam, it does not reproduce any real assessment, and its mastery percentages are an in-app learning indicator only — they are not standardised scores and do not predict performance in any actual 11+ assessment. The app states this on screen wherever those figures are shown.

Anyone using this alongside official preparation should treat the schools' and providers' own familiarisation material as the authoritative guide to format and expectations.
