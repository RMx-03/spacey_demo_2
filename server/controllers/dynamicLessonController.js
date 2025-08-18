const { aiOrchestrator } = require('./aiOrchestrator');
const { dynamicLessonGenerator } = require('./dynamicLessonGenerator');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { advancedTutoringStrategy } = require('./advancedTutoringStrategy');

/**
 * Dynamic Lesson Controller - Handles all dynamic lesson generation and adaptive tutoring endpoints
 */

/**
 * Generate a completely new dynamic lesson based on user preferences and profile
 */
const generateDynamicLesson = async (req, res) => {
  try {
    const { user, lessonRequest } = req.body;

    if (!user?.id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`🎯 Generating dynamic lesson for user ${user.id}`);

    // Route through AI Orchestrator for consistent processing
    const orchestratorRequest = {
      type: 'dynamic_lesson_generation',
      user: {
        id: user.id,
        name: user.name || user.displayName || 'Explorer',
        email: user.email || 'anonymous@example.com'
      },
      context: {
        baseLesson: lessonRequest?.baseLesson,
        topic: lessonRequest?.topic,
        learningObjectives: lessonRequest?.learningObjectives || [],
        difficultyLevel: lessonRequest?.difficultyLevel || 'adaptive',
        estimatedDuration: lessonRequest?.estimatedDuration || 20,
        focusAreas: lessonRequest?.focusAreas || [],
        customRequirements: lessonRequest?.customRequirements || ''
      }
    };

    const response = await aiOrchestrator.processRequest(orchestratorRequest);

    res.status(200).json({
      success: true,
      message: response.message,
      lesson: response.lesson,
      personalization: response.personalization,
      metadata: response.metadata
    });

  } catch (error) {
    console.error('❌ Error generating dynamic lesson:', error);
    res.status(500).json({
      error: 'Failed to generate dynamic lesson',
      details: error.message
    });
  }
};

/**
 * Adapt an existing lesson based on current user state and progress
 */
const adaptExistingLesson = async (req, res) => {
  try {
    const { user, currentLesson, currentBlock, userResponse, adaptationRequest } = req.body;

    if (!user?.id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!currentLesson) {
      return res.status(400).json({ error: 'Current lesson context is required' });
    }

    console.log(`📚 Adapting lesson for user ${user.id}: ${currentLesson.title}`);

    // Route through AI Orchestrator for adaptive lesson delivery
    const orchestratorRequest = {
      type: 'adaptive_lesson_delivery',
      user: {
        id: user.id,
        name: user.name || user.displayName || 'Explorer',
        email: user.email || 'anonymous@example.com'
      },
      prompt: adaptationRequest?.reason || 'Requesting lesson adaptation based on current progress',
      context: {
        currentLesson,
        currentBlock,
        userResponse,
        adaptationReason: adaptationRequest?.reason,
        adaptationType: adaptationRequest?.type || 'difficulty', // difficulty, style, pace, engagement
        specificNeeds: adaptationRequest?.specificNeeds || []
      }
    };

    const response = await aiOrchestrator.processRequest(orchestratorRequest);

    res.status(200).json({
      success: true,
      message: response.message,
      adaptedContent: response.adaptedContent,
      strategy: response.strategy,
      personalization: response.personalization,
      recommendations: response.metadata?.next_recommendations,
      metadata: response.metadata
    });

  } catch (error) {
    console.error('❌ Error adapting lesson:', error);
    res.status(500).json({
      error: 'Failed to adapt lesson',
      details: error.message
    });
  }
};

/**
 * Get enhanced tutoring response using advanced pedagogical strategies
 */
const getEnhancedTutoringResponse = async (req, res) => {
  try {
    const { user, prompt, context } = req.body;

    if (!user?.id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'User prompt is required' });
    }

    console.log(`🎓 Providing enhanced tutoring for user ${user.id}`);

    // Route through AI Orchestrator for enhanced tutoring
    const orchestratorRequest = {
      type: 'enhanced_tutoring',
      user: {
        id: user.id,
        name: user.name || user.displayName || 'Explorer',
        email: user.email || 'anonymous@example.com'
      },
      prompt,
      context: {
        lessonContext: context?.lessonContext,
        currentTopic: context?.currentTopic,
        userMood: context?.userMood,
        learningGoal: context?.learningGoal,
        difficultyPreference: context?.difficultyPreference,
        tutoringStyle: context?.tutoringStyle || 'adaptive', // socratic, direct, guided, inquiry
        immediateNeed: context?.immediateNeed // clarification, encouragement, challenge, practice
      }
    };

    const response = await aiOrchestrator.processRequest(orchestratorRequest);

    res.status(200).json({
      success: true,
      message: response.message,
      strategy: response.strategy,
      methodology: response.metadata?.tutoring_methodology,
      socraticElements: response.metadata?.socratic_elements,
      nextActions: response.metadata?.adaptive_actions,
      metadata: response.metadata
    });

  } catch (error) {
    console.error('❌ Error in enhanced tutoring:', error);
    res.status(500).json({
      error: 'Failed to provide enhanced tutoring',
      details: error.message
    });
  }
};

/**
 * Get personalization insights for a user
 */
const getPersonalizationInsights = async (req, res) => {
  try {
    const { userId } = req.params;
    const { contextData, forceRefresh } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`🧠 Generating personalization insights for user ${userId}`);

    const insights = await enhancedPersonalizationEngine.generatePersonalizationInsights(
      userId, 
      { ...contextData, forceRefresh: forceRefresh === true }
    );

    res.status(200).json({
      success: true,
      insights,
      recommendations: insights.recommendations,
      confidence: insights.confidence
    });

  } catch (error) {
    console.error('❌ Error getting personalization insights:', error);
    res.status(500).json({
      error: 'Failed to get personalization insights',
      details: error.message
    });
  }
};

/**
 * Get tutoring strategy for current context
 */
const getTutoringStrategy = async (req, res) => {
  try {
    const { userId } = req.params;
    const { context } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`🎓 Generating tutoring strategy for user ${userId}`);

    const strategy = await advancedTutoringStrategy.generateTutoringStrategy(userId, context || {});

    res.status(200).json({
      success: true,
      strategy,
      methodology: strategy.methodology,
      questioning: strategy.questioning,
      sequencing: strategy.sequencing,
      confidence: strategy.confidence
    });

  } catch (error) {
    console.error('❌ Error getting tutoring strategy:', error);
    res.status(500).json({
      error: 'Failed to get tutoring strategy',
      details: error.message
    });
  }
};

/**
 * Generate a custom lesson based on specific learning objectives
 */
const generateCustomLesson = async (req, res) => {
  try {
    const { user, customRequest } = req.body;

    if (!user?.id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!customRequest?.topic && !customRequest?.learningObjectives) {
      return res.status(400).json({ error: 'Topic or learning objectives are required' });
    }

    console.log(`🛠️ Generating custom lesson for user ${user.id}: ${customRequest.topic}`);

    const lessonRequest = {
      baseTopicOrLesson: `custom_${Date.now()}`,
      learningObjectives: customRequest.learningObjectives || [`Learn about ${customRequest.topic}`],
      difficultyLevel: customRequest.difficultyLevel || 'adaptive',
      estimatedDuration: customRequest.estimatedDuration || 25,
      focusAreas: customRequest.focusAreas || [customRequest.topic],
      customRequirements: customRequest.customRequirements || '',
      creativeElements: customRequest.creativeElements || []
    };

    const generatedLesson = await dynamicLessonGenerator.generateDynamicLesson(user.id, lessonRequest);

    res.status(200).json({
      success: true,
      message: `I've created a custom lesson on "${customRequest.topic}" just for you!`,
      lesson: generatedLesson,
      customizations: {
        topic: customRequest.topic,
        objectives: lessonRequest.learningObjectives,
        duration: generatedLesson.estimated_duration,
        blocks: generatedLesson.blocks.length
      }
    });

  } catch (error) {
    console.error('❌ Error generating custom lesson:', error);
    res.status(500).json({
      error: 'Failed to generate custom lesson',
      details: error.message
    });
  }
};

/**
 * Get lesson adaptation suggestions based on user performance
 */
const getLessonAdaptationSuggestions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { lessonProgress, performanceData, currentStruggle } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`📊 Getting adaptation suggestions for user ${userId}`);

    // Generate personalization insights with performance context
    const insights = await enhancedPersonalizationEngine.generatePersonalizationInsights(userId, {
      lessonProgress,
      performanceData,
      currentStruggle
    });

    // Generate tutoring strategy for adaptation
    const strategy = await advancedTutoringStrategy.generateTutoringStrategy(userId, {
      lessonProgress,
      performanceData,
      currentStruggle,
      adaptationRequest: true
    });

    const suggestions = {
      immediate_adaptations: strategy.actions?.immediate_actions,
      content_modifications: {
        difficulty_adjustment: strategy.sequencing?.difficulty_gradient,
        pacing_changes: strategy.sequencing?.cognitive_load_management,
        style_adaptations: insights.adaptiveStrategies?.content_adaptation
      },
      engagement_boosters: insights.adaptiveStrategies?.engagement_optimization,
      next_steps: strategy.sequencing?.optimal_next_steps
    };

    res.status(200).json({
      success: true,
      suggestions,
      reasoning: strategy.methodology?.primary_methodology?.reasoning,
      confidence: Math.min(insights.confidence, strategy.confidence)
    });

  } catch (error) {
    console.error('❌ Error getting adaptation suggestions:', error);
    res.status(500).json({
      error: 'Failed to get adaptation suggestions',
      details: error.message
    });
  }
};

module.exports = {
  generateDynamicLesson,
  adaptExistingLesson,
  getEnhancedTutoringResponse,
  getPersonalizationInsights,
  getTutoringStrategy,
  generateCustomLesson,
  getLessonAdaptationSuggestions
};
