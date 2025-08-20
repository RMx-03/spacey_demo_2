const { aiProviderManager } = require('./aiProviders');
const { dynamicLessonGenerator } = require('./dynamicLessonGenerator');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { advancedTutoringStrategy } = require('./advancedTutoringStrategy');
const { userAssessmentTracker } = require('./userAssessmentTracker');
const { parseAIJSONResponse } = require('../utils/jsonParser');
const { lessonPlanner } = require('./lessonPlanner');
const { persistentMemory } = require('./persistentMemory');

/**
 * LessonSessionEngine orchestrates a live tutoring session with:
 * - Story-first narration
 * - Short, natural tutor turns (not monologue TTS)
 * - Socratic prompts and adaptive strategies
 * - Continuous flow using the generated lesson blocks
 */
class LessonSessionEngine {
  constructor() {
    this.sessions = new Map(); // sessionId -> state
  }

  _sessionKey(userId, missionId) {
    return `${userId}:${missionId}`;
  }

  async startSession(user, lessonRequest) {
    // New pipeline: plan -> generate first block lazily
    const topic = lessonRequest?.topic || lessonRequest?.baseLesson || 'space_exploration';
    const userProfile = await persistentMemory.getUserProfile(user.id).catch(() => ({ identity: { name: user.name || 'Explorer' }, learning: {} }));
    const planSteps = await lessonPlanner.createPlan(topic, userProfile);

    const missionId = `dynamic_lesson_${Date.now()}`;
    const sessionId = this._sessionKey(user.id, missionId);
    const personalization = await enhancedPersonalizationEngine.generatePersonalizationInsights(user.id).catch(() => ({}));
    const enhancedContext = await persistentMemory.generateEnhancedContext(user.id).catch(() => ({}));
    const conversationSummary = await persistentMemory.summarizeContext(user.id).catch(() => '');

    const firstBlock = await dynamicLessonGenerator.generateContentForStep(planSteps[0], {
      topic,
      userProfile,
      learningAnalysis: personalization.learningAnalysis || null,
      enhancedContext,
      previousBlocks: [],
      conversationSummary,
    });

    const lesson = {
      mission_id: missionId,
      title: `Mission: ${topic}`,
      description: 'Interactive, personalized lesson with branching',
      total_blocks: 1,
      estimated_duration: (planSteps[0].estimated_minutes || 2),
      difficulty_level: lessonRequest?.difficultyLevel || 'adaptive',
      learning_objectives: lessonRequest?.learningObjectives || [],
      blocks: [firstBlock],
    };

    const state = {
      sessionId,
      user: { id: user.id, name: user.name || user.displayName || 'Explorer' },
      lesson,
      personalization,
      enhancedContext,
      conversationSummary,
      topic,
      userProfile,
      plan: planSteps,
      planIndexById: Object.fromEntries(planSteps.map((s, i) => [s.id, i])),
      blockIndex: 0,
      turnIndex: 0,
      turnsByBlock: new Map(), // blockIndex -> [{ say, question, meta }]
      startedAt: Date.now(),
      lastAssessment: null,
      history: [],
    };

    await this._ensureTurnsForBlock(state, 0);
    this.sessions.set(sessionId, state);
    return this._currentTurnPayload(state);
  }

  async nextTurn(userId, missionId) {
    const state = this._requireSession(userId, missionId);
    const { blockIndex, turnIndex } = state;
    const turns = state.turnsByBlock.get(blockIndex) || [];

    if (turnIndex + 1 < turns.length) {
      state.turnIndex += 1;
      return this._currentTurnPayload(state);
    }

    // If current block is a choice, surface options and wait for submitResponse
    if ((state.lesson.blocks[blockIndex]?.type || '').toLowerCase() === 'choice') {
      return { ...this._currentTurnPayload(state), awaitingChoice: true, choices: state.lesson.blocks[blockIndex].choices || [] };
    }

    // Move or generate next block
    const hasNextGenerated = blockIndex + 1 < state.lesson.blocks.length;
    if (hasNextGenerated) {
      state.blockIndex += 1;
      state.turnIndex = 0;
      await this._ensureTurnsForBlock(state, state.blockIndex);
      return this._currentTurnPayload(state);
    }

    // Lazily generate next step from plan
    const currentBlock = state.lesson.blocks[blockIndex];
    const currentStepIdx = state.planIndexById[currentBlock.block_id] ?? blockIndex;
    const nextStep = state.plan[currentStepIdx + 1];
    if (nextStep) {
      // Refresh personalization and context each step for dynamic behavior
      const [personalization, enhancedContext, conversationSummary] = await Promise.all([
        enhancedPersonalizationEngine.generatePersonalizationInsights(state.user.id).catch(() => state.personalization),
        persistentMemory.generateEnhancedContext(state.user.id).catch(() => state.enhancedContext),
        persistentMemory.summarizeContext(state.user.id).catch(() => state.conversationSummary),
      ]);
      state.personalization = personalization;
      state.enhancedContext = enhancedContext;
      state.conversationSummary = conversationSummary;
      const nextBlock = await dynamicLessonGenerator.generateContentForStep(nextStep, {
        topic: state.topic,
        userProfile: state.userProfile,
        learningAnalysis: state.personalization.learningAnalysis || null,
        enhancedContext: state.enhancedContext,
        previousBlocks: state.lesson.blocks,
        conversationSummary: state.conversationSummary,
      });
      state.lesson.blocks.push(nextBlock);
      state.blockIndex += 1;
      state.turnIndex = 0;
      await this._ensureTurnsForBlock(state, state.blockIndex);
      return this._currentTurnPayload(state);
    }

    return { done: true, message: 'Lesson complete. Great job!' };
  }

  async submitResponse(userId, missionId, userResponse) {
    const state = this._requireSession(userId, missionId);
    const block = state.lesson.blocks[state.blockIndex];

    // Real-time assessment feedback
    const assessment = await userAssessmentTracker.performRealTimeAssessment(userId, {
      userResponse: typeof userResponse === 'string' ? userResponse : JSON.stringify(userResponse),
      responseTime: 0,
      questionType: block.type || 'prompt',
      expectedAnswer: block.learning_goal || null,
      lessonContext: { missionId: state.lesson.mission_id, title: state.lesson.title, block },
      previousAttempts: 0,
      hintUsage: 0,
    }).catch(() => null);
    state.lastAssessment = assessment;

    // If awaiting a choice selection, branch generation
    if ((block.type || '').toLowerCase() === 'choice') {
      const selectionIndex = typeof userResponse === 'object' ? (userResponse.choiceIndex ?? null) : null;
      const selectionText = typeof userResponse === 'object' ? (userResponse.choiceText ?? null) : null;
      let chosen = null;
      const choices = Array.isArray(block.choices) ? block.choices : [];
      if (selectionIndex != null && choices[selectionIndex]) {
        chosen = choices[selectionIndex];
      } else if (selectionText) {
        chosen = choices.find(c => (c.text || '').toLowerCase() === String(selectionText).toLowerCase());
      }
      const nextId = chosen?.next_block || null;
      const nextIdx = nextId != null ? (state.planIndexById[nextId] ?? null) : null;
      const planIdxFallback = (state.planIndexById[block.block_id] ?? state.blockIndex) + 1;
      const nextStep = nextIdx != null ? state.plan[nextIdx] : state.plan[planIdxFallback];
      if (nextStep) {
        // Refresh personalization and context at branching point
        const [personalization, enhancedContext, conversationSummary] = await Promise.all([
          enhancedPersonalizationEngine.generatePersonalizationInsights(state.user.id).catch(() => state.personalization),
          persistentMemory.generateEnhancedContext(state.user.id).catch(() => state.enhancedContext),
          persistentMemory.summarizeContext(state.user.id).catch(() => state.conversationSummary),
        ]);
        state.personalization = personalization;
        state.enhancedContext = enhancedContext;
        state.conversationSummary = conversationSummary;
        const nextBlock = await dynamicLessonGenerator.generateContentForStep(nextStep, {
          topic: state.topic,
          userProfile: state.userProfile,
          learningAnalysis: state.personalization.learningAnalysis || null,
          enhancedContext: state.enhancedContext,
          previousBlocks: state.lesson.blocks,
          conversationSummary: state.conversationSummary,
        });
        state.lesson.blocks.push(nextBlock);
        state.blockIndex += 1;
        state.turnIndex = 0;
        await this._ensureTurnsForBlock(state, state.blockIndex);
      }
      return { branched: true, choice: chosen || null, ...this._currentTurnPayload(state) };
    }

    // Generate brief, natural feedback and a micro-next step using LLM
    const feedbackPrompt = `Provide short natural tutor feedback and next action as JSON for this response.

CONTEXT:
Lesson Title: ${state.lesson.title}
Block Title: ${block.title}
Learning Goal: ${block.learning_goal}
User Response: ${typeof userResponse === 'string' ? userResponse : JSON.stringify(userResponse)}

Return ONLY JSON:
{
  "feedback": "1-2 sentences of supportive, specific feedback",
  "next_action": "question|explanation|example|analogy|checkpoint",
  "follow_up_question": "a concise question if next_action is question, else null",
  "confidence": 0.0-1.0
}`;

    let feedback = { feedback: 'Thanks for sharing!', next_action: 'question', follow_up_question: null, confidence: 0.6 };
    try {
      const resp = await aiProviderManager.generateResponse(feedbackPrompt, 'gemini');
      feedback = parseAIJSONResponse(resp);
    } catch (_) {}

    return {
      assessment,
      feedback,
      next_recommendation: await this._maybeRecommendNext(state, feedback)
    };
  }

  endSession(userId, missionId) {
    const key = this._sessionKey(userId, missionId);
    const state = this.sessions.get(key);
    if (state) this.sessions.delete(key);
    return { ended: true };
  }

  getState(userId, missionId) {
    return this._requireSession(userId, missionId);
  }

  // Internals
  _requireSession(userId, missionId) {
    const key = this._sessionKey(userId, missionId);
    const state = this.sessions.get(key);
    if (!state) throw new Error('Session not found');
    return state;
  }

  async _ensureTurnsForBlock(state, blockIndex) {
    if (state.turnsByBlock.has(blockIndex)) return;
    const block = state.lesson.blocks[blockIndex];

    // Derive 3-6 short turns from the block content, add Socratic elements
    const baseTurns = this._splitContentIntoTurns(block.content);

    // Add a Socratic question if available
    const socratic = block.tutoring_elements?.socratic_questions || [];
    if (socratic.length > 0) {
      baseTurns.splice(1, 0, { say: null, question: socratic[0], meta: { type: 'socratic' } });
    }

    // Clamp to a reasonable size
    const turns = baseTurns.slice(0, 6);
    state.turnsByBlock.set(blockIndex, turns);
  }

  _splitContentIntoTurns(content = '') {
    if (!content || typeof content !== 'string') return [{ say: 'Let’s continue.', question: null, meta: { type: 'narration' } }];
    const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const turns = [];
    for (const p of paragraphs) {
      // Keep 1-2 sentences per turn for natural cadence
      const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
      const text = sentences.slice(0, 2).join(' ');
      turns.push({ say: text, question: null, meta: { type: 'narration' } });
    }
    if (turns.length === 0) turns.push({ say: content.slice(0, 200), question: null, meta: { type: 'narration' } });
    return turns;
  }

  _currentTurnPayload(state) {
    const block = state.lesson.blocks[state.blockIndex];
    const turns = state.turnsByBlock.get(state.blockIndex) || [];
    const turn = turns[state.turnIndex] || { say: 'Continuing…', question: null };

    return {
      sessionId: state.sessionId,
      missionId: state.lesson.mission_id,
      title: state.lesson.title,
      blockId: block.block_id,
      blockType: block.type,
      indices: { block: state.blockIndex, turn: state.turnIndex },
      tutor_turn: {
        say: turn.say,
        question: turn.question,
        media: block.media || null,
      },
      choices: (block.type || '').toLowerCase() === 'choice' ? (block.choices || []) : undefined,
      next_hint: block.llm_instruction ? 'Tutor will guide with short, supportive turns.' : null,
      done: false,
    };
  }

  async _maybeRecommendNext(state, feedback) {
    try {
      const strategy = await advancedTutoringStrategy.generateTutoringStrategy(state.user.id, {
        lessonData: { title: state.lesson.title },
        currentBlock: state.lesson.blocks[state.blockIndex],
        feedback,
      });
      return {
        next_actions: strategy.actions?.immediate_actions,
        methodology: strategy.methodology?.primary_methodology,
      };
    } catch (_) {
      return null;
    }
  }
}

const lessonSessionEngine = new LessonSessionEngine();
module.exports = { lessonSessionEngine };
