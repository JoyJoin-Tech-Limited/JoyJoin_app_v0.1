# Candidate Memory Notes

This directory is for reviewable candidate notes that are intentionally committed for discussion or promotion.

Typical flow:

- keep local drafts or reviewer packets under `.joyjoin/` until the wording is ready for code review
- stage the reviewed markdown note into this directory with `npm run memory:stage-candidate -- <source-note-path> [candidate-target-path]`
- promote only from this directory with `npm run memory:promote -- repo-memory/candidates/...`

`.joyjoin/` drafts are not a direct promotion surface. Promotion fails closed unless the input is already a validated candidate note under `repo-memory/candidates/`.