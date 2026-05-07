/**
 * Analyze question bank for social desirability bias
 * Identifies questions where A/O/X/P traits have no negative scoring options
 */

import { questionsV4 } from '../packages/shared/src/personality/questionsV4';
import { TraitKey } from '../packages/shared/src/personality/types';

interface BiasAnalysis {
  id: string;
  level: number;
  category: string;
  questionText: string;
  biasScore: number;
  problematicTraits: string[];
}

const socialDesirabilityTraits: TraitKey[] = ['A', 'O', 'X', 'P'];

function analyzeQuestion(q: typeof questionsV4[0]): BiasAnalysis {
  const problematicTraits: string[] = [];
  let biasScore = 0;
  
  for (const trait of socialDesirabilityTraits) {
    const scores = q.options.map(opt => opt.traitScores[trait] || 0);
    const hasNegative = scores.some(s => s < 0);
    const maxPositive = Math.max(...scores);
    
    if (!hasNegative && maxPositive > 0) {
      biasScore += maxPositive;
      problematicTraits.push(`${trait}(+${maxPositive})`);
    }
  }
  
  return {
    id: q.id,
    level: q.level,
    category: q.category,
    questionText: q.questionText,
    biasScore,
    problematicTraits
  };
}

const analyses = questionsV4.map(analyzeQuestion);
analyses.sort((a, b) => b.biasScore - a.biasScore);

console.log('='.repeat(80));
console.log('TOP 12 MOST BIASED QUESTIONS (priority for rewriting)');
console.log('='.repeat(80));

for (let i = 0; i < 12; i++) {
  const a = analyses[i];
  if (a.biasScore === 0) break;
  
  console.log(`\n${i + 1}. ${a.id} [L${a.level}] Bias: ${a.biasScore} | ${a.category}`);
  console.log(`   "${a.questionText}"`);
  console.log(`   Missing negative: ${a.problematicTraits.join(', ')}`);
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
const biased = analyses.filter(a => a.biasScore > 0);
console.log(`Total: ${questionsV4.length} | Biased: ${biased.length} | Clean: ${questionsV4.length - biased.length}`);
