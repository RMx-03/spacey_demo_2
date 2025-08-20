const { aiProviderManager } = require('./aiProviders');
const { parseAIJSONResponse, fixCommonJSONIssues } = require('../utils/jsonParser');
const prompts = require('../prompts');

class LessonPlanner {
  async createPlan(topic, userProfile) {
    const plannerPrompt = prompts.createLessonPlanPrompt({ topic, userProfile });
    try {
      const raw = await aiProviderManager.generateResponse(plannerPrompt, 'gemini');
      try {
        const parsed = parseAIJSONResponse(raw);
        if (!Array.isArray(parsed)) throw new Error('Planner must return a JSON array');
        // Basic normalization
        const steps = parsed.map((step, idx) => ({
          id: step.id || `step_${idx + 1}`,
          type: String(step.type || 'narration').toLowerCase(),
          title: step.title || `Step ${idx + 1}`,
          objective: step.objective || 'Learn a key concept',
          estimated_minutes: Number(step.estimated_minutes || 2),
          options: Array.isArray(step.options) ? step.options : undefined,
        }));
        return steps;
      } catch (e) {
        const cleaned = fixCommonJSONIssues(String(raw));
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed)) throw e;
        return parsed;
      }
    } catch (error) {
      // Fallback deterministic plan (8 steps)
      const total = 8;
      return Array.from({ length: total }, (_, i) => {
        const idx = i + 1;
        const isChoice = idx % 4 === 0;
        return {
          id: isChoice ? `choice_${idx}` : `step_${idx}`,
          type: isChoice ? 'choice' : (idx % 3 === 0 ? 'quiz' : 'narration'),
          title: isChoice ? `Choose your path ${idx}` : `Learning Step ${idx}`,
          objective: isChoice ? 'Select an exploration path' : `Understand concept ${idx}`,
          estimated_minutes: isChoice ? 2 : 3,
          options: isChoice ? [
            { text: 'Path A', next: `step_${idx + 1}` },
            { text: 'Path B', next: `step_${idx + 1}` },
          ] : undefined,
        };
      });
    }
  }
}

const lessonPlanner = new LessonPlanner();
module.exports = { lessonPlanner };


