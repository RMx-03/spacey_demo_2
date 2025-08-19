const { aiProviderManager } = require('./aiProviders');
const { dynamicLessonGenerator } = require('./dynamicLessonGenerator');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { advancedTutoringStrategy } = require('./advancedTutoringStrategy');
const { userAssessmentTracker } = require('./userAssessmentTracker');
const { parseAIJSONResponse } = require('../utils/jsonParser');

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
    // 1) Generate a lesson (uses personalization and tutoring enhancements internally)
    const lesson = await dynamicLessonGenerator.generateDynamicLesson(user.id, lessonRequest || {});

    // 2) Build session state
    const missionId = lesson.mission_id;
    const sessionId = this._sessionKey(user.id, missionId);
    const personalization = await enhancedPersonalizationEngine.generatePersonalizationInsights(user.id).catch(() => ({}));

    const state = {
      sessionId,
      user: { id: user.id, name: user.name || user.displayName || 'Explorer' },
      lesson,
      personalization,
      blockIndex: 0,
      turnIndex: 0,
      turnsByBlock: new Map(), // blockIndex -> [{ say, question, meta }]
      startedAt: Date.now(),
      lastAssessment: null,
      history: []
    };

    // 3) Precompute short tutor turns for the first block
    await this._ensureTurnsForBlock(state, 0);
    this.sessions.set(sessionId, state);

    // 4) Return the first tutor turn
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

    // Move to next block
    if (blockIndex + 1 < state.lesson.blocks.length) {
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
