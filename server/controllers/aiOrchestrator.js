const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const { traitAnalyzer } = require('./traitAnalyzer');
const { knowledgeGraphManager } = require('./knowledgeGraphManager');
const pineconeRetriever = require('./pineconeRetriever');
const { conversationMemory } = require('./conversationMemory');
const { extractAndStoreFacts, extractHybrid, personalizationController } = require('./personalizationController');
const prompts = require('../prompts');
const userProfileMemory = require('./userProfileMemory');
const { dynamicLessonGenerator } = require('./dynamicLessonGenerator');
const { lessonPlanner } = require('./lessonPlanner');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { advancedTutoringStrategy } = require('./advancedTutoringStrategy');

// Optional RAG chain (LangChain). Loaded lazily to avoid hard dependency at boot.
let ragChatChain = null;
async function getRagChatChain() {
  if (ragChatChain) return ragChatChain;
  if (process.env.RAG_ENABLED !== 'true') return null;
  try {
    // Dynamic import to keep CommonJS compatibility
    const { createRagChatChain } = await import('../rag/chatChain.mjs');
    ragChatChain = await createRagChatChain();
    return ragChatChain;
  } catch (e) {
    console.error('Failed to initialize RAG chat chain:', e);
    return null;
  }
}

/**
 * Unified AI Orchestrator
 * Centralizes all AI request handling with consistent context building,
 * trait analysis, and response generation across different interaction types.
 */
class AIOrchestrator {
  constructor() {
    this.requestHistory = new Map(); // For tracking conversation context
  }

  /**
   * Main entry point for all AI interactions
   * @param {Object} request - The request payload
   * @param {string} request.type - Type of interaction ('chat', 'lesson_analysis', 'avatar_response', 'tutoring')
   * @param {Object} request.user - User information
   * @param {string} request.prompt - User input (for chat/tutoring)
   * @param {Object} request.context - Additional context (lesson data, visual info, etc.)
   * @returns {Promise<Object>} Unified response with message, traits, and metadata
   */
  async processRequest(request) {
    const { type, user, prompt, context = {} } = request;
    const userId = user?.id || 'anonymous';

    console.log(`🧠 AI Orchestrator processing: ${type} for user ${userId}`);

    try {
      // Fast path for simple chat interactions
      if (type === 'chat' && this.shouldUseFastPath(request)) {
        console.log(`⚡ Using fast path for chat request`);
        return await this.handleFastChatInteraction(request);
      }

      // 1. Build comprehensive context for complex interactions
      const unifiedContext = await this.buildUnifiedContext(userId, request);

      // 2. Route to appropriate handler
      let response;
      switch (type) {
        case 'chat':
          response = await this.handleChatInteraction(unifiedContext);
          break;
        case 'lesson_analysis':
          response = await this.handleLessonAnalysis(unifiedContext);
          break;
        case 'avatar_response':
          response = await this.handleAvatarResponse(unifiedContext);
          break;
        case 'tutoring':
          response = await this.handleTutoringInteraction(unifiedContext);
          break;
        case 'dynamic_lesson_generation':
          response = await this.handleDynamicLessonGeneration(unifiedContext);
          break;
        case 'enhanced_tutoring':
          response = await this.handleEnhancedTutoring(unifiedContext);
          break;
        case 'adaptive_lesson_delivery':
          response = await this.handleAdaptiveLessonDelivery(unifiedContext);
          break;
        default:
          throw new Error(`Unknown interaction type: ${type}`);
      }

      // 3. Post-process and store interaction
      await this.postProcessInteraction(userId, request, response);

      return response;

    } catch (error) {
      console.error(`❌ AI Orchestrator error for ${type}:`, error);
      return this.generateFallbackResponse(type, error);
    }
  }

  /**
   * Builds comprehensive context by aggregating all available data sources
   */
  async buildUnifiedContext(userId, request) {
    const { user, context = {}, prompt } = request;

    // Parallel context gathering for performance
    const useLegacyRetrieval = process.env.RAG_ENABLED !== 'true';
    const [
      conversationSummary,
      enhancedContext,
      emotionalState,
      traitAnalysis,
      retrievedContext,
      knowledgeGraph,
      latestSummary,
      semanticMemory
    ] = await Promise.all([
      persistentMemory.summarizeContext(userId),
      persistentMemory.generateEnhancedContext(userId),
      prompt ? persistentMemory.detectEmotionalState(userId, prompt) : null,
      prompt && context.lessonData ? 
        traitAnalyzer.analyzeTraits(prompt, context.lessonData?.title || 'general', user.traits || []) : 
        null,
      useLegacyRetrieval ? (prompt ? pineconeRetriever.getRelevantContext(prompt) : null) : null,
      persistentMemory.getUserKnowledgeGraph(userId), // Fetch the knowledge graph
      persistentMemory.loadLatestSummary(userId),
      (async () => {
        if (!prompt) return '';
        const main = await conversationMemory.searchRelevant(userId, prompt, Number(process.env.CONVERSATIONS_TOP_K || 4));
        // Try identity recall as a second pass if name/email asked
        let identity = '';
        const identityHints = /(my name|what.*my name|who am i|my email)/i.test(prompt || '')
          ? await conversationMemory.searchRelevant(userId, 'user_name OR user_email', 2)
          : '';
        identity = identityHints || '';
        // Include brief Context Header from profile & sessions
        let header = '';
        try {
          const profile = await persistentMemory.getUserProfile(userId);
          const now = Date.now();
          const notExpired = !profile.sessions._ephemeralExpiry || profile.sessions._ephemeralExpiry > now;
          const currentSubject = notExpired ? profile.sessions.currentSubject : null;
          const currentTask = notExpired ? profile.sessions.currentTask : null;
          const headerLines = [];
          if (profile?.userId) headerLines.push(`user_id=${profile.userId}`);
          // Prefer identity facts
          const nameFact = await conversationMemory.searchRelevant(userId, 'user_name=', 1, { type: 'fact', factType: 'identity', key: 'name' });
          if (nameFact) headerLines.push(`name_hint=${nameFact.split('=')[1] || ''}`);
          if (currentSubject) headerLines.push(`current_subject=${currentSubject}`);
          if (currentTask) headerLines.push(`current_task=${currentTask}`);
          const prefs = (profile.learning?.preferredTopics || []).slice(0, 3);
          if (prefs.length) headerLines.push(`preferred_topics=${prefs.join(',')}`);
          const struggling = (profile.learning?.strugglingTopics || []).slice(-3);
          if (struggling.length) headerLines.push(`struggling_topics=${struggling.join(',')}`);
          header = headerLines.join('\n');
        } catch {} // Ignore errors during header generation
        return [header, main, identity].filter(Boolean).join('\n\n—\n\n');
      })()
    ]);

    // Pull durable identity to use as active context (name, email, etc.)
    let identity = {};
    try {
      identity = await userProfileMemory.fetchIdentity(userId);
      if (!identity?.name) {
        const prof = await persistentMemory.getUserProfile(userId);
        identity = { ...identity, ...(prof.identity || {}) };
      }
    } catch (_) {} // Ignore errors during identity fetch

    return {
      // Original request data
      ...request,
      
      // Enhanced context
      conversationSummary,
      enhancedContext,
      emotionalState,
      traitAnalysis,
      retrievedContext,
      knowledgeGraph,
      rollingSummary: latestSummary,
      semanticMemory,
      
      // Computed metadata
      userProfile: {
        id: userId,
        name: identity?.name || user?.name || 'Explorer',
        traits: user?.traits || [],
        learningStyle: enhancedContext.learningStyle,
        strugglingTopics: enhancedContext.strugglingTopics || [],
        masteredConcepts: enhancedContext.masteredConcepts || []
      },
      identity,
      
      // Interaction metadata
      timestamp: new Date().toISOString(),
      sessionInteractions: enhancedContext.sessionInteractions || 0
    };
  }

  /**
   * Handles general chat interactions
   */
  async handleChatInteraction(context) {
    const { prompt, userProfile, conversationSummary, emotionalState, retrievedContext, knowledgeGraph, semanticMemory } = context;
    const hasHistory = Array.isArray(context?.context?.conversationHistory) && context.context.conversationHistory.length > 0;

    // Try RAG path first if enabled
    const chain = await getRagChatChain();
    if (chain) {
      try {
        const filters = {};
        // If lesson context exists within enhanced context, pass metadata
        if (context?.context?.lessonContext?.mission_id) {
          filters.lessonId = context.context.lessonContext.mission_id;
        }
        // Use knowledge graph hints as concept tags
        if (knowledgeGraph && Object.keys(knowledgeGraph.nodes || {}).length > 0) {
          filters.concepts = Object.keys(knowledgeGraph.nodes);
        }

        // Build long-term facts string from persistent profile + durable identity
        let longTermFacts = '';
        try {
          const profile = await persistentMemory.getUserProfile(userProfile.id);
          const facts = [];
          if (profile?.userId) facts.push(`User ID: ${profile.userId}`);
          if (profile?.learning?.preferredStyle && profile.learning.preferredStyle !== 'unknown') facts.push(`Prefers ${profile.learning.preferredStyle} explanations`);
          if (Array.isArray(profile?.learning?.preferredTopics) && profile.learning.preferredTopics.length > 0) facts.push(`Interested in: ${profile.learning.preferredTopics.slice(0,5).join(', ')}`);
          if (Array.isArray(profile?.learning?.strugglingTopics) && profile.learning.strugglingTopics.length > 0) facts.push(`Needs help with: ${profile.learning.strugglingTopics.slice(-5).join(', ')}`);
          if (Array.isArray(profile?.learning?.masteredConcepts) && profile.learning.masteredConcepts.length > 0) facts.push(`Understands: ${profile.learning.masteredConcepts.slice(-5).join(', ')}`);
          if (profile?.visual?.age) facts.push(`Approx. age: ${profile.visual.age}`);
          if (profile?.visual?.gender) facts.push(`Gender: ${profile.visual.gender}`);
          const ident = context.identity || profile.identity || {};
          if (ident?.name) facts.push(`Name: ${ident.name}`);
          if (ident?.email) facts.push(`Email: ${ident.email}`);
          if (ident?.nationality) facts.push(`Nationality: ${ident.nationality}`);
          if (ident?.age) facts.push(`Age: ${ident.age}`);
          if (ident?.timezone) facts.push(`Timezone: ${ident.timezone}`);
          if (Array.isArray(ident?.languages) && ident.languages.length) facts.push(`Languages: ${ident.languages.join(', ')}`);
          longTermFacts = facts.join('\n');
        } catch (_) {} // Ignore errors during fact generation

        const ragResult = await chain.invoke({
          input: prompt,
          userProfile,
          conversationSummary,
          emotionalState,
          filters,
          longTermFacts,
          semanticMemory
        });

        if ((ragResult?.retrievedCount || 0) === 0) {
          // Skip generation path entirely; fall back to non-RAG prompt once
          throw new Error('RAG_EMPTY');
        }

        let message = ragResult?.output || ragResult?.text || ragResult;
        message = this.stripGreeting(message, hasHistory);
        const citations = ragResult?.citations || [];

        await this.updateKnowledgeFromInteraction(userProfile.id, prompt, message);

        // If RAG found no documents, fall back to general Spacey prompt for broad Q&A
        // if we reached here, we had docs and produced a RAG answer

        return {
          message,
          type: 'chat_response',
          metadata: { emotionalState, hasRetrievedContext: true, citations }
        };
      } catch (err) {
        if (err && err.message === 'RAG_EMPTY') {
          console.log('ℹ️ RAG returned 0 docs — skipping generation and falling back');
        } else {
          console.error('RAG chain failed, falling back to legacy prompt:', err.message);
        }
      }
    }

    // Legacy non-RAG path
    let strategy = null;
    try {
      const { decideTutoringStrategy } = require('./tutoringStrategy');
      strategy = await decideTutoringStrategy(userProfile.id, {
        prompt,
        userProfile: {
          learningStyle: userProfile.learningStyle,
          traits: userProfile.traits,
          preferredTopics: context?.enhancedContext?.preferredTopics || []
        },
        emotionalState,
        rawContext: context.context,
        enhancedContext: context.enhancedContext || {},
        identity: context.identity || {}
      });
    } catch {} // Ignore errors during strategy decision

    const chatPrompt = prompts.composeChatPrompt({
      userPrompt: prompt,
      userProfile,
      conversationSummary,
      emotionalState,
      retrievedContext,
      knowledgeGraph,
      rawContext: context.context,
      semanticMemory,
      identity: context.identity || {},
      strategy
    });

    const responseRaw = await aiProviderManager.generateResponse(chatPrompt);
    const response = this.stripGreeting(responseRaw, hasHistory);
    await this.updateKnowledgeFromInteraction(userProfile.id, prompt, response);
    return {
      message: response,
      type: 'chat_response',
      metadata: { emotionalState, hasRetrievedContext: !!retrievedContext }
    };
  }

  /**
   * Handles lesson-specific analysis and storytelling
   */
  async handleLessonAnalysis(context) {
    const { 
      context: { lessonData, currentBlock, userResponse }, 
      userProfile, 
      traitAnalysis, 
      emotionalState,
      prompt
    } = context;

    // Ensure we have a trait analysis object (fallback if not provided)
    const effectiveTraitAnalysis = traitAnalysis || await traitAnalyzer.analyzeTraits(
      userResponse?.ai_reaction || userResponse?.text || prompt || '',
      lessonData?.title || 'general',
      userProfile?.traits || []
    );

    // Build a conversational prompt (merged from conversationalGenerator.js)
    const conversationalPrompt = prompts.composeConversationalLessonPrompt({
      lessonData,
      currentBlock,
      userResponse,
      userTags: userProfile?.traits || [],
      analysis: effectiveTraitAnalysis,
      emotionContext: emotionalState,
      visualInfo: context?.context?.visualContext,
      eventType: 'interaction',
      decisionHistory: []
    });

    let response = await aiProviderManager.generateResponse(conversationalPrompt);
    if (typeof response === 'string') {
      // Clean any code fences if model returns them
      response = response.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim();
    }

    return {
      message: response,
      type: 'lesson_analysis',
      addedTraits: effectiveTraitAnalysis?.traits_to_add || [],
      removedTraits: effectiveTraitAnalysis?.traits_to_remove || [],
      reasoning: effectiveTraitAnalysis?.reasoning,
      metadata: {
        blockId: currentBlock.block_id,
        blockType: currentBlock.type,
        confidence: effectiveTraitAnalysis?.confidence || 0,
        analysis: effectiveTraitAnalysis
      }
    };
  }

  /**
   * Handles avatar-specific contextual responses
   */
  async handleAvatarResponse(context) {
    const { context: { trigger, visualContext }, userProfile, conversationSummary } = context;

    const avatarPrompt = prompts.composeAvatarPrompt({
      trigger,
      visualContext,
      userProfile,
      conversationSummary
    });

    const response = await aiProviderManager.generateResponse(avatarPrompt);

    return {
      message: response,
      type: 'avatar_response',
      trigger,
      metadata: {
        hasVisualContext: !!visualContext,
        trigger
      }
    };
  }

  /**
   * Handles advanced tutoring interactions with pedagogical intelligence
   */
  async handleTutoringInteraction(context) {
    const { 
      prompt, 
      userProfile, 
      enhancedContext, 
      emotionalState, 
      retrievedContext,
      context: { lessonContext }
    } = context;

    const tutoringPrompt = prompts.composeTutoringPrompt({
      userPrompt: prompt,
      userProfile,
      enhancedContext,
      emotionalState,
      retrievedContext,
      lessonContext
    });

    const response = await aiProviderManager.generateResponse(tutoringPrompt);

    return {
      message: response,
      type: 'tutoring_response',
      metadata: {
        adaptiveDifficulty: this.calculateAdaptiveDifficulty(userProfile, enhancedContext),
        knowledgeGaps: this.identifyKnowledgeGaps(userProfile, prompt),
        recommendedActions: this.generateRecommendations(userProfile, enhancedContext)
      }
    };
  }

  /**
   * Builds chat-specific prompts
   */
  // buildChatPrompt now centralized in promptComposer

  stripGreeting(text, hasHistory) {
    try {
      if (!text) return text;
      let out = String(text).trim();
      if (!hasHistory) return out;
      // Remove common greeting openers once, case-insensitive
      out = out.replace(/^\s*(?:\*\*\s*)?(?:Greetings|Hello|Hi|Hey)[,!.\s]*(?:[A-Z][a-zA-Z]+)?[,!.\s]*\s*/i, '');
      return out.trim();
    } catch { return text; } // Ignore errors during greeting stripping
  }

  

  

  

  /**
   * Calculates adaptive difficulty based on user performance
   */
  calculateAdaptiveDifficulty(userProfile, enhancedContext) {
    const mastered = Array.isArray(userProfile.masteredConcepts) ? userProfile.masteredConcepts : [];
    const struggling = Array.isArray(userProfile.strugglingTopics) ? userProfile.strugglingTopics : [];
    const masteryRatio = mastered.length / (mastered.length + struggling.length + 1);
    const interactionLevel = Number(enhancedContext.totalInteractions || 0);
    
    if (masteryRatio > 0.7 && interactionLevel > 50) return 'advanced';
    if (masteryRatio > 0.4 && interactionLevel > 20) return 'intermediate';
    return 'beginner';
  }

  /**
   * Identifies knowledge gaps from user input
   */
  identifyKnowledgeGaps(userProfile, prompt) {
    // Simple keyword-based gap identification (could be enhanced with ML)
    const gaps = [];
    const text = String(prompt || '').toLowerCase();
    if (text.includes('confused') || text.includes("don't understand")) {
      gaps.push('conceptual_understanding');
    }
    if (text.includes('how') || text.includes('why')) {
      gaps.push('procedural_knowledge');
    }
    return gaps;
  }

  /**
   * Generates learning recommendations
   */
  generateRecommendations(userProfile, enhancedContext) {
    const recommendations = [];
    
    if (userProfile.strugglingTopics.length > 2) {
      recommendations.push('review_fundamentals');
    }
    if (enhancedContext.sessionInteractions > 10) {
      recommendations.push('take_break');
    }
    if (userProfile.masteredConcepts.length > 5) {
      recommendations.push('advanced_concepts');
    }
    
    return recommendations;
  }

  /**
   * Updates the knowledge graph based on the interaction.
   */
  async updateKnowledgeFromInteraction(userId, prompt, response) {
    // This is a simplified example. A more advanced implementation would
    // use NLP to extract concepts and determine mastery changes.
    const concepts = this.extractConcepts(prompt + ' ' + response);
    
    for (const concept of concepts) {
      let masteryChange = 0.05; // Default small increase
      if (prompt.toLowerCase().includes('confused') || prompt.toLowerCase().includes("don't understand")) {
        masteryChange = -0.1; // Decrease mastery if user is confused
      }
      await persistentMemory.updateUserKnowledgeGraph(userId, concept, masteryChange, 'Chat interaction');
    }
  }

  /**
   * Extracts concepts from a text string (simple keyword matching).
   */
  extractConcepts(text) {
    const concepts = [];
    const lowerText = text.toLowerCase();
    // This would be expanded with a more robust concept dictionary
    if (lowerText.includes('black hole')) concepts.push('Black Holes');
    if (lowerText.includes('general relativity')) concepts.push('General Relativity');
    if (lowerText.includes('gravity')) concepts.push('Gravity');
    if (lowerText.includes('mars')) concepts.push('Mars');
    if (lowerText.includes('solar panel')) concepts.push('Solar Panels');
    return [...new Set(concepts)]; // Return unique concepts
  }

  /**
   * Post-processes interactions and stores in memory
   */
  async postProcessInteraction(userId, request, response) {
    try {
      await persistentMemory.addInteraction(userId, request.prompt || '[NO_PROMPT]', response.message, {
        type: request.type,
        timestamp: new Date().toISOString(),
        addedTraits: response.addedTraits,
        emotionalState: response.metadata?.emotionalState,
        provider: aiProviderManager.defaultProvider
      });

      // Upsert to semantic conversation memory and ingest personalization
      try {
        const sessionId = await persistentMemory.getCurrentSessionId(userId);
        await conversationMemory.upsertTurn(userId, request.prompt || '', response.message || '', { sessionId });
        await personalizationController.ingestChatTurn(
          userId,
          request.prompt || '',
          response.message || '',
          {
            visualContext: request?.context?.visualContext || null,
            lessonContext: request?.context?.lessonContext || null,
            currentTopic: request?.context?.currentTopic || null
          }
        );
      } catch (e) {
        console.warn('Conversation memory upsert skipped:', e.message);
      }

      // Keep a rolling summary to prevent memory bloat (throttled)
      try {
        const recent = await persistentMemory.getRecentInteractions(userId, 25);
        const profile = await persistentMemory.getUserProfile(userId);
        const totalInteractions = profile?.stats?.totalInteractions || 0;
        if (recent.length >= 20 && totalInteractions % 25 === 0) {
          // Generate/update a short summary with the provider LLM every 25 interactions
          const transcript = recent.map(r => `USER: ${r.userMessage}\nAI: ${r.aiResponse}`).join('\n');
          const summaryPrompt = `Summarize the following chat into 5-8 concise bullet points of durable facts and preferences about the user and ongoing tasks. Keep neutral tone.\n\n${transcript}`;
          const summaryText = await aiProviderManager.generateResponse(summaryPrompt);
          await persistentMemory.saveRollingSummary(userId, summaryText);
        }
      } catch (e) {
        console.warn('Summary maintenance skipped:', e.message);
      }
      
      console.log(`✅ Interaction stored for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to store interaction:', error);
    }
  }

  /**
   * Generates fallback responses for errors
   */
  generateFallbackResponse(type, error) {
    const fallbackMessages = {
      chat: "Oops, my circuits got a bit tangled there! Give me a moment to recalibrate my stellar wit.",
      lesson_analysis: "I'm processing your choice, Commander. The implications are vast - let me analyze further.",
      avatar_response: "My sensors are recalibrating - give me just a moment.",
      tutoring: "Let me reorganize my teaching algorithms and get back to you with a proper explanation."
    };

    return {
      message: fallbackMessages[type] || "Something went wrong in my systems. Please try again.",
      type: `${type}_fallback`,
      error: true,
      metadata: {
        errorType: error.constructor.name,
        errorMessage: error.message
      }
    };
  }

  /**
   * Handle dynamic lesson generation requests
   */
  async handleDynamicLessonGeneration(context) {
    console.log('🎯 Handling dynamic lesson generation');
    const { user, context: requestContext } = context;
    const userId = user.id;

    try {
      const topic = requestContext.baseLesson || requestContext.topic || 'space_exploration';

      // 1) Plan
      const fullProfile = await persistentMemory.getUserProfile(userId).catch(() => (context.userProfile || {}));
      const planSteps = await lessonPlanner.createPlan(topic, fullProfile);

      // 2) Personalization insights
      const personalizationInsights = await enhancedPersonalizationEngine.generatePersonalizationInsights(
        userId,
        { currentLesson: { topic, planSteps }, forceRefresh: false }
      );

      // 3) Generate slides per step (sequential to preserve branching points)
      const blocks = [];
      for (const step of planSteps) {
        const block = await dynamicLessonGenerator.generateContentForStep(step, {
          topic,
          userProfile: fullProfile,
          learningAnalysis: personalizationInsights.learningAnalysis || null,
          previousBlocks: blocks,
        });
        blocks.push(block);
      }

      // 4) Assemble lesson
      const missionId = `dynamic_lesson_${Date.now()}`;
      const estimated_duration = planSteps.reduce((sum, s) => sum + (Number(s.estimated_minutes) || 2), 0);
      const generatedLesson = {
        mission_id: missionId,
        title: `Mission: ${topic}`,
        description: 'Personalized, interactive lesson with branching choices.',
        total_blocks: blocks.length,
        estimated_duration,
        difficulty_level: requestContext.difficultyLevel || 'adaptive',
        learning_objectives: requestContext.learningObjectives || [],
        block_structure: planSteps.map(s => ({ block_id: s.id, type: s.type, title: s.title })),
        blocks,
        generated_at: new Date().toISOString(),
        user_id: userId,
        personalization_applied: true,
      };

      return {
        message: `I've created a personalized multi-step lesson on "${topic}" with ${blocks.length} slides.`,
        type: 'dynamic_lesson_generation',
        lesson: generatedLesson,
        personalization: personalizationInsights,
        metadata: {
          generation_method: 'planner_worker_pipeline',
          personalization_confidence: personalizationInsights.confidence,
          total_blocks: generatedLesson.blocks.length,
        }
      };
    } catch (error) {
      console.error('❌ Error in dynamic lesson generation (planner pipeline):', error);
      throw error;
    }
  }

  /**
   * Handle enhanced tutoring interactions using advanced strategies
   */
  async handleEnhancedTutoring(context) {
    console.log('🎓 Handling enhanced tutoring');
    
    const { user, prompt, context: requestContext } = context;
    const userId = user.id;

    try {
      // Generate comprehensive tutoring strategy
      const tutoringStrategy = await advancedTutoringStrategy.generateTutoringStrategy(userId, {
        ...requestContext,
        userPrompt: prompt,
        currentContext: context
      });

      // Generate personalized response based on strategy
      const tutoringPrompt = this.buildEnhancedTutoringPrompt(context, tutoringStrategy);
      const aiResponse = await aiProviderManager.generateResponse(tutoringPrompt, 'gemini');

      return {
        message: aiResponse,
        type: 'enhanced_tutoring',
        strategy: tutoringStrategy,
        metadata: {
          tutoring_methodology: tutoringStrategy.methodology?.primary_methodology?.approach,
          socratic_elements: tutoringStrategy.questioning?.socratic_principles,
          personalization_confidence: tutoringStrategy.confidence,
          adaptive_actions: tutoringStrategy.actions?.immediate_actions
        }
      };

    } catch (error) {
      console.error('❌ Error in enhanced tutoring:', error);
      throw error;
    }
  }

  /**
   * Handle adaptive lesson delivery that adjusts in real-time
   */
  async handleAdaptiveLessonDelivery(context) {
    console.log('📚 Handling adaptive lesson delivery');
    
    const { user, prompt, context: requestContext } = context;
    const userId = user.id;

    try {
      // Get current lesson context
      const currentLesson = requestContext.currentLesson;
      const currentBlock = requestContext.currentBlock;
      const userResponse = requestContext.userResponse;

      // Generate personalization insights with current context
      const personalizationInsights = await enhancedPersonalizationEngine.generatePersonalizationInsights(
        userId, 
        { currentLesson, currentBlock, userResponse }
      );

      // Generate tutoring strategy for this specific moment
      const tutoringStrategy = await advancedTutoringStrategy.generateTutoringStrategy(userId, {
        ...requestContext,
        personalizationInsights
      });

      // Adapt the current lesson content if needed
      let adaptedContent = currentBlock?.content;
      if (tutoringStrategy.actions?.immediate_actions?.primary_action?.type === 'adaptation') {
        adaptedContent = await this.adaptLessonContent(currentBlock, personalizationInsights, tutoringStrategy);
      }

      // Generate contextual response
      const adaptivePrompt = this.buildAdaptiveLessonPrompt(context, personalizationInsights, tutoringStrategy, adaptedContent);
      const aiResponse = await aiProviderManager.generateResponse(adaptivePrompt, 'gemini');

      return {
        message: aiResponse,
        type: 'adaptive_lesson_delivery',
        adaptedContent,
        strategy: tutoringStrategy,
        personalization: personalizationInsights,
        metadata: {
          adaptation_applied: !!adaptedContent,
          tutoring_approach: tutoringStrategy.methodology?.primary_methodology?.approach,
          next_recommendations: tutoringStrategy.sequencing?.optimal_next_steps
        }
      };

    } catch (error) {
      console.error('❌ Error in adaptive lesson delivery:', error);
      throw error;
    }
  }

  /**
   * Build enhanced tutoring prompt using advanced strategies
   */
  buildEnhancedTutoringPrompt(context, tutoringStrategy) {
    const { user, prompt, enhancedContext, emotionalState } = context;
    
    return `You are Spacey, an advanced AI tutor with sophisticated pedagogical capabilities. Use the provided tutoring strategy to deliver an optimal learning experience.

TUTORING STRATEGY:
Methodology: ${tutoringStrategy.methodology?.primary_methodology?.approach}
Immediate Action: ${JSON.stringify(tutoringStrategy.actions?.immediate_actions?.primary_action)}
Questioning Strategy: ${JSON.stringify(tutoringStrategy.questioning?.questioning_sequence?.opening_questions)}

LEARNER CONTEXT:
User: ${user.name || 'Explorer'}
Current Understanding: ${enhancedContext?.masteredConcepts?.join(', ') || 'Assessing...'}
Knowledge Gaps: ${enhancedContext?.strugglingTopics?.join(', ') || 'None identified'}
Learning Style: ${tutoringStrategy.personalization?.learningAnalysis?.learningStyle?.primary || 'Adaptive'}
Emotional State: ${emotionalState?.emotion || 'Engaged'}

USER MESSAGE: "${prompt}"

TUTORING INSTRUCTIONS:
1. Apply the ${tutoringStrategy.methodology?.primary_methodology?.approach} methodology
2. Use the immediate action: ${tutoringStrategy.actions?.immediate_actions?.primary_action?.type}
3. Incorporate Socratic questioning where appropriate
4. Adapt to the learner's cognitive state and emotional needs
5. Maintain engagement through space exploration narratives
6. Provide scaffolding at level: ${tutoringStrategy.actions?.strategic_actions?.concept_development?.progression_steps?.[0] || 'foundational'}

Respond as Spacey with sophisticated tutoring that feels natural and engaging while implementing the advanced pedagogical strategies.`;
  }

  /**
   * Build adaptive lesson delivery prompt
   */
  buildAdaptiveLessonPrompt(context, personalizationInsights, tutoringStrategy, adaptedContent) {
    const { user, prompt, context: requestContext } = context;
    
    return `You are Spacey, delivering an adaptive lesson that adjusts in real-time to the learner's needs.

PERSONALIZATION INSIGHTS:
Learning Analysis: ${JSON.stringify(personalizationInsights.learningAnalysis?.learningStyle)}
Cognitive Profile: ${JSON.stringify(personalizationInsights.cognitiveProfile?.optimal_conditions)}
Knowledge Mapping: Critical gaps: ${personalizationInsights.knowledgeMapping?.critical_gaps?.join(', ') || 'none'}

CURRENT LESSON CONTEXT:
${requestContext.currentLesson ? `Lesson: ${requestContext.currentLesson.title}` : 'No lesson context'}
${requestContext.currentBlock ? `Block: ${requestContext.currentBlock.block_id}` : 'No block context'}
${adaptedContent ? `Adapted Content: ${adaptedContent}` : 'Using original content'}

TUTORING STRATEGY:
Approach: ${tutoringStrategy.methodology?.primary_methodology?.approach}
Scaffolding Level: ${tutoringStrategy.actions?.strategic_actions?.concept_development?.progression_steps?.[0]}
Next Steps: ${tutoringStrategy.sequencing?.optimal_next_steps?.join(', ') || 'Continue current path'}

USER MESSAGE: "${prompt}"

ADAPTIVE INSTRUCTIONS:
1. Respond to the user's message in the context of their current lesson
2. Use the identified optimal tutoring approach
3. Adjust complexity based on cognitive profile
4. Apply personalized engagement strategies
5. Guide toward the optimal next learning steps
6. Maintain the space mission narrative and excitement

Deliver a response that feels perfectly tailored to this specific learner at this specific moment in their learning journey.`;
  }

  /**
   * Adapt lesson content based on personalization insights
   */
  async adaptLessonContent(currentBlock, personalizationInsights, tutoringStrategy) {
    if (!currentBlock) return null;

    const adaptationPrompt = `Adapt this lesson content for optimal personalization.

ORIGINAL CONTENT:
${currentBlock.content}

PERSONALIZATION INSIGHTS:
Learning Style: ${personalizationInsights.learningAnalysis?.learningStyle?.primary}
Cognitive Load Preference: ${personalizationInsights.cognitiveProfile?.optimal_conditions?.cognitive_load}
Motivational Factors: ${JSON.stringify(personalizationInsights.learningAnalysis?.motivationalFactors?.intrinsicMotivators)}

TUTORING STRATEGY:
Recommended Approach: ${tutoringStrategy.methodology?.primary_methodology?.approach}
Scaffolding Level: ${tutoringStrategy.actions?.strategic_actions?.concept_development?.progression_steps?.[0]}

ADAPTATION REQUIREMENTS:
1. Adjust complexity for cognitive load preference
2. Incorporate preferred learning style elements
3. Add motivational hooks from learner profile
4. Apply recommended scaffolding level
5. Maintain space exploration theme
6. Keep core learning objectives intact

Return adapted content that is optimally personalized for this learner while preserving the essential learning goals.`;

    try {
      const adaptedContent = await aiProviderManager.generateResponse(adaptationPrompt, 'gemini');
      return adaptedContent;
    } catch (error) {
      console.error('Error adapting lesson content:', error);
      return currentBlock.content; // Fallback to original
    }
  }

  /**
   * Determines if a chat request can use the fast path
   */
  shouldUseFastPath(request) {
    const { context = {}, prompt } = request;
    
    // Use fast path if:
    // 1. No complex lesson context (not in active lesson navigation)
    // 2. Simple conversational prompt (not asking for lesson generation)
    // 3. Not requesting specific tutoring features
    
    const isInActiveLesson = context.currentLesson || context.lessonData;
    const isComplexRequest = prompt && (
      prompt.toLowerCase().includes('generate') ||
      prompt.toLowerCase().includes('create lesson') ||
      prompt.toLowerCase().includes('dynamic') ||
      prompt.toLowerCase().includes('analyze') ||
      prompt.toLowerCase().includes('tutoring') ||
      prompt.length > 300 // Longer prompts likely need full context
    );
    const needsFullTutoring = context.tutoringStyle === 'socratic' || 
                             context.requiresPersonalization || 
                             context.forceFullProcessing;

    // Always use full processing if there's lesson context
    // Use fast path only for casual conversational interactions
    return !isInActiveLesson && !isComplexRequest && !needsFullTutoring;
  }

  /**
   * Fast path chat handler - minimal processing for instant responses
   */
  async handleFastChatInteraction(request) {
    const { user, prompt, context = {} } = request;
    const userId = user?.id || 'anonymous';

    try {
      // Enhanced user info (still cached/lightweight but more complete)
      const basicProfile = await this.getBasicUserProfile(userId);
      
      // Get recent conversation context for continuity
      const recentContext = await this.getRecentConversationContext(userId, 3); // Last 3 interactions
      
      // Enhanced prompt with conversation context
      const contextualPrompt = this.buildContextualFastChatPrompt(prompt, basicProfile, context, recentContext);
      
      // Single AI call for response with timeout protection
      const response = await Promise.race([
        aiProviderManager.generateResponse(contextualPrompt, 'gemini'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Fast path timeout')), 10000) // 10 second timeout
        )
      ]);
      
      // Trigger background processing (non-blocking)
      this.triggerBackgroundProcessing(userId, request, response).catch(err => 
        console.log('Background processing error (non-critical):', err.message)
      );

      return {
        message: response,
        traits: null, // Skip trait analysis for speed
        emotional_state: null,
        thinking_pattern: null,
        metadata: {
          response_time: Date.now(),
          processing_method: 'fast_path',
          background_processing: true
        }
      };

    } catch (error) {
      console.error('Fast chat error, falling back to full processing:', error);
      // Fallback to full processing if fast path fails
      return await this.processRequest({ ...request, context: { ...context, forceFullProcessing: true } });
    }
  }

  /**
   * Get recent conversation context for continuity
   */
  async getRecentConversationContext(userId, limit = 3) {
    try {
      const interactions = await persistentMemory.getRecentInteractions(userId, limit);
      return interactions.map(interaction => ({
        user: interaction.userMessage || interaction.content || '',
        spacey: interaction.aiResponse || '',
        timestamp: interaction.timestamp
      }));
    } catch (error) {
      console.log('No recent context available');
      return [];
    }
  }

  /**
   * Get basic user profile from cache or minimal DB query
   */
  async getBasicUserProfile(userId) {
    try {
      // Try cache first
      if (this.profileCache && this.profileCache[userId]) {
        const cached = this.profileCache[userId];
        if (Date.now() - cached.timestamp < 300000) { // 5 min cache
          return cached.profile;
        }
      }

      // Minimal profile fetch
      const profile = await persistentMemory.fetchUserProfile(userId);
      
      // Cache it
      if (!this.profileCache) this.profileCache = {};
      this.profileCache[userId] = {
        profile: {
          name: profile?.name || 'Explorer',
          preferredTopics: profile?.learning?.preferredTopics || [],
          strugglingTopics: profile?.learning?.strugglingTopics || [],
          learningStyle: profile?.learning?.preferredStyle || 'multimodal'
        },
        timestamp: Date.now()
      };

      return this.profileCache[userId].profile;
    } catch (error) {
      console.log('Using default profile for fast path');
      return { name: 'Explorer', preferredTopics: [], strugglingTopics: [], learningStyle: 'multimodal' };
    }
  }

  // Removed unused buildFastChatPrompt (use buildContextualFastChatPrompt instead)

  /**
   * Build a contextual fast chat prompt with conversation history
   */
  buildContextualFastChatPrompt(prompt, basicProfile, context, recentContext) {
    let conversationHistory = '';
    if (recentContext.length > 0) {
      conversationHistory = '\n\nRECENT CONVERSATION:\n';
      recentContext.forEach((interaction, i) => {
        if (interaction.user) {
          conversationHistory += `You: ${interaction.user}\n`;
        }
        if (interaction.spacey) {
          conversationHistory += `Spacey: ${interaction.spacey.substring(0, 150)}${interaction.spacey.length > 150 ? '...' : ''}\n`;
        }
      });
      conversationHistory += '\n';
    }

    return `You are Spacey, an enthusiastic AI space tutor and mission specialist aboard a space station. You have a warm, encouraging personality and love sharing the wonders of space exploration.

USER: ${basicProfile.name || 'Explorer'}
${basicProfile.preferredTopics?.length ? `KNOWN INTERESTS: ${basicProfile.preferredTopics.join(', ')}` : ''}
${basicProfile.strugglingTopics?.length ? `AREAS TO SUPPORT: ${basicProfile.strugglingTopics.join(', ')}` : ''}
${basicProfile.learningStyle ? `LEARNING STYLE: ${basicProfile.learningStyle}` : ''}${conversationHistory}
CURRENT MESSAGE: "${prompt}"

CONVERSATION GUIDELINES:
- Remember and reference our previous conversations naturally
- Build on topics we've discussed before
- Use the user's name (${basicProfile.name || 'Explorer'}) occasionally
- Maintain continuity and personal connection
- Be enthusiastic but not repetitive
- Ask follow-up questions that show you're listening and engaged
- Connect new topics to their known interests when relevant

PERSONALITY & STYLE:
- Warm, encouraging, and genuinely excited about space
- Use vivid space imagery and real mission examples
- Ask thoughtful follow-up questions to keep the conversation flowing
- Connect topics to space exploration when natural
- Maintain conversational flow - don't sound scripted or template-like
- Be curious about what the user finds most interesting
- Share fascinating space facts and stories when relevant
- Show genuine interest in their thoughts and questions

RESPONSE APPROACH:
1. Acknowledge any context from our previous conversation if relevant
2. Respond naturally to their current message with enthusiasm
3. Add interesting details or examples related to their topic
4. Ask a thoughtful follow-up question to continue the conversation
5. Make connections to space exploration when it feels natural

Respond as the real Spacey - conversational, curious, passionate about space, and genuinely interested in continuing our ongoing dialogue:`;
  }

  /**
   * Trigger background processing for analytics and profiling (non-blocking)
   */
  async triggerBackgroundProcessing(userId, request, assistantMessage = '') {
    // Run heavy processing in background without blocking response
    setTimeout(async () => {
      try {
        console.log(`🔄 Background processing for user ${userId}`);
        
        // Update user analytics
        const { prompt } = request;
        if (prompt) {
          // Call methods with correct parameters
          const interactionData = {
            userMessage: prompt,
            timestamp: Date.now(),
            processing_method: 'fast_path_background'
          };
          
          await persistentMemory.updateUserAnalytics(userId, interactionData);
          await persistentMemory.addInteraction(userId, prompt, assistantMessage || '', {
            processing_method: 'fast_path_background',
            timestamp: Date.now(),
            emotionalState: { emotion: 'neutral', confidence: 0.0 },
            learningStyle: 'unknown'
          });
        }

        console.log(`✅ Background processing completed for user ${userId}`);
      } catch (error) {
        console.log(`❌ Background processing failed for user ${userId}:`, error.message);
      }
    }, 100); // Start background work after 100ms
  }
}

// Create singleton instance
const aiOrchestrator = new AIOrchestrator();

module.exports = { aiOrchestrator };