import { loadPersonas } from './lib/persona-utils';
import { runAssessmentSimulation } from './lib/persona-utils';

const personas = loadPersonas().filter(p => p.id.includes('centroid'));
console.log(`Tracing ${personas.length} centroids...\n`);

for (const persona of personas) {
  const result = runAssessmentSimulation(persona, { verbose: true });
  if (result.assignedArchetype !== persona.expectedArchetype) {
    console.log(`\n=== ${persona.name} (${persona.expectedArchetype}) → ${result.assignedArchetype} ===`);
    console.log(`Questions asked: ${result.questionsAsked}`);
    console.log(`Final traits: ${JSON.stringify(result.finalTraits)}`);
    if (result.questionLog) {
      for (const q of result.questionLog.slice(0, 20)) {
        console.log(`  ${q.questionId} → ${q.selectedOption} (${q.optionText?.slice(0, 30)})`);
      }
    }
  }
}
