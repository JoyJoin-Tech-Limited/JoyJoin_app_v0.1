# Color Extraction Summary — Actual vs Current Tokens

## Methodology
- Sampled specific pixel coordinates from character body areas
- Avoided background, transparency, and extreme highlights/shadows
- Used ImageMagick `convert -format '%[hex:u.p{x,y}]'` for precise sampling

## Extracted Primary Colors (from actual illustrations)

| Archetype | Chinese Name | Extracted Hex | Extracted HSL | Current HSL | Match? |
|-----------|-------------|---------------|---------------|-------------|--------|
| corgi | 气氛组柯基 | #CB9268 | h:25 s:48% l:60% | h:43 s:96% l:56% | ⚠️ Close |
| fox | 探宝雷达狐 | #C68E61 | h:26 s:46% l:57% | h:25 s:95% l:53% | ⚠️ Close |
| rooster | 情绪稳定鸡 | #C49538 | h:38 s:71% l:50% | h:50 s:90% l:55% | ⚠️ Different hue |
| octopus | 脑洞喷泉章鱼 | #CB8783 | h:3 s:40% l:65% | h:271 s:91% l:65% | ❌ COMPLETELY WRONG |
| dolphin_calm | 读空气海豚 | #B8DFEF | h:197 s:63% l:82% | h:187 s:85% l:53% | ❌ Wrong lightness |
| spider | 社交裁缝蛛 | #62526A | h:280 s:12% l:36% | h:220 s:50% l:45% | ❌ Wrong hue |
| koala | 情绪树洞考拉 | #ADABBC | h:247 s:11% l:70% | h:24 s:80% l:50% | ❌ COMPLETELY WRONG |
| owl | 追问猫头鹰 | #714C42 | h:12 s:26% l:35% | h:260 s:50% l:50% | ❌ COMPLETELY WRONG |
| cat | 静音模式猫 | #D8D6C7 | h:52 s:17% l:81% | h:280 s:40% l:55% | ❌ COMPLETELY WRONG |
| hamster_praise | 捧场王仓鼠 | #D8C6B7 | h:27 s:29% l:78% | h:340 s:75% l:65% | ❌ COMPLETELY WRONG |
| elephant | 定海神针大象 | #BCCADE | h:215 s:34% l:80% | h:200 s:30% l:55% | ⚠️ Close hue, wrong L |
| turtle | 慢半拍龟 | #4D613A | h:90 s:25% l:30% | h:150 s:60% l:45% | ❌ Wrong hue |

## Major Discrepancies Found

**COMPLETELY WRONG (hue off by >60°):**
- octopus: Purple in code, PINK in illustration
- koala: Orange in code, GRAY-LAVENDER in illustration  
- owl: Purple in code, BROWN in illustration
- cat: Purple in code, WARM GRAY in illustration
- hamster_praise: Pink in code, BEIGE in illustration
- turtle: Teal in code, OLIVE GREEN in illustration

**MODERATELY WRONG (lightness/saturation off):**
- dolphin_calm: 53% lightness in code, 82% in illustration (much lighter)
- elephant: 55% lightness in code, 80% in illustration (much lighter)
- rooster: Generic yellow in code, golden-amber in illustration

**REASONABLY CLOSE:**
- corgi: Both orange-tan family
- fox: Both orange family

## Family Mapping (from code)

```
warm:  corgi, rooster, hamster_praise
cool:  fox, dolphin_calm, octopus
fire:  koala, spider
calm:  owl, elephant, turtle, cat
```

Note: Family mapping is based on personality traits, not color similarity.
