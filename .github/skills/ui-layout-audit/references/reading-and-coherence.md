# Reading experience & visual coherence rules

Detailed numeric rules backing audit-workflow steps 7 (reading experience) and 8 (visual coherence / 孤字 guard). The workflow summarizes these; this file holds the full measurements.

## Reading experience rules

- Chinese body text: line-height ≥1.6, measure (line length) ≤30 Chinese characters
- Display/headline text: line-height ≥1.4. 1.28 or lower feels suffocating
- Paragraph spacing should be ≥0.8× font-size. Tight paragraphs feel like a wall of text
- Two heavy visual elements (large text + large image) back-to-back need breathing room (≥32rpx)

## Visual coherence rules

- Headlines, banners, buttons: `word-break: keep-all` + ensure container ≥ font-size × 8 wide. If the text is longer, the container must be wider — never let a headline break into a 2-character orphan line
- English words inside Chinese copy: wrap in `nowrap` or use `word-break: keep-all` so "Livehouse" never becomes "Liveh-ouse"
- Narrow cards (e.g., 240rpx wide): labels must be ≤6 characters at 32rpx, or the card will force 孤字
- `overflow-wrap: anywhere` is banned on display text — it treats all break points as equal and produces visual chaos
