const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const userProfileMemory = require('./userProfileMemory');

/**
 * Helper function to clean and parse JSON responses from AI
 */
function parseAIJSONResponse(response) {
  try {
    // First try direct parsing
    return JSON.parse(response);
  } catch (error) {
    console.log('Direct JSON parse failed, trying extraction methods...');
    
    // If that fails, try to extract JSON from markdown blocks
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[1].trim();
        // Try to fix common JSON issues
        jsonStr = fixCommonJSONIssues(jsonStr);
        return JSON.parse(jsonStr);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON:', innerError);
        console.error('JSON content (first 500 chars):', jsonMatch[1].substring(0, 500));
      }
    }
    
    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        let jsonStr = objectMatch[0];
        // Try to fix common JSON issues
        jsonStr = fixCommonJSONIssues(jsonStr);
        return JSON.parse(jsonStr);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON object:', innerError);
        console.error('JSON content (first 500 chars):', objectMatch[0].substring(0, 500));
      }
    }
    
    console.error('No valid JSON found in AI response (first 200 chars):', response.substring(0, 200));
    throw new Error(`No valid JSON found in AI response`);
  }
}

/**
 * Attempt to fix common JSON formatting issues
 */
function fixCommonJSONIssues(jsonStr) {
  // Remove any markdown code blocks
  jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
  
  // Remove trailing commas in arrays and objects
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix missing commas between array elements
  jsonStr = jsonStr.replace(/"\s*\n\s*"/g, '",\n"');
  jsonStr = jsonStr.replace(/}\s*\n\s*{/g, '},\n{');
  jsonStr = jsonStr.replace(/]\s*\n\s*\[/g, '],\n[');
  
  // Fix unquoted property names
  jsonStr = jsonStr.replace(/(\w+):/g, '"$1":');
  
  // Fix single quotes to double quotes
  jsonStr = jsonStr.replace(/'/g, '"');
  
  // Remove comments
  jsonStr = jsonStr.replace(/\/\/.*$/gm, '');
  jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove any trailing commas before closing brackets
  jsonStr = jsonStr.replace(/,(\s*})/g, '$1');
  jsonStr = jsonStr.replace(/,(\s*])/g, '$1');
  
  // Ensure proper bracket matching
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/]/g) || []).length;
  
  // Add missing closing braces/brackets
  if (openBraces > closeBraces) {
    jsonStr += '}' .repeat(openBraces - closeBraces);
  }
  if (openBrackets > closeBrackets) {
    jsonStr += ']'.repeat(openBrackets - closeBrackets);
  }
  
  return jsonStr.trim();
}

/**
 * Enhanced Personalization Engine - Provides deep user insights and personalization strategies
 * for dynamic lesson generation and adaptive tutoring
 */
class EnhancedPersonalizationEngine {
  constructor() {
    this.userInsightsCache = new Map(); // userId -> insights cache
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
  }

  /**
   * Generate comprehensive personalization insights for a user
   * @param {string} userId - User identifier  
   * @param {Object} contextData - Additional context (current lesson, recent interactions, etc.)
   * @returns {Promise<Object>} Detailed personalization insights
   */
  async generatePersonalizationInsights(userId, contextData = {}) {
    console.log(`🧠 Generating personalization insights for user ${userId}`);

    // Check cache first
    const cached = this.getCachedInsights(userId);
    if (cached && !contextData.forceRefresh) {
      return cached;
    }

    try {
      // 1. Gather comprehensive user data
      const userData = await this.gatherUserData(userId);
      
      // 2. Analyze learning patterns and preferences
      const learningAnalysis = await this.analyzeLearningPatterns(userData);
      
      // 3. Identify knowledge gaps and strengths
      const knowledgeMapping = await this.mapKnowledgeState(userData, contextData);
      
      // 4. Generate cognitive and emotional profile
      const cognitiveProfile = await this.buildCognitiveProfile(userData, learningAnalysis);
      
      // 5. Create adaptive strategies
      const adaptiveStrategies = await this.generateAdaptiveStrategies(userData, learningAnalysis, knowledgeMapping, cognitiveProfile);
      
      // 6. Compile comprehensive insights
      const insights = {
        userId,
        timestamp: new Date().toISOString(),
        learningAnalysis,
        knowledgeMapping,
        cognitiveProfile,
        adaptiveStrategies,
        contextualized: contextData,
        confidence: this.calculateConfidenceScore(userData, learningAnalysis),
        recommendations: await this.generatePersonalizationRecommendations(learningAnalysis, knowledgeMapping, cognitiveProfile)
      };

      // Cache the insights
      this.cacheInsights(userId, insights);
      
      return insights;

    } catch (error) {
      console.error('❌ Error generating personalization insights:', error);
      throw new Error('Failed to generate personalization insights: ' + error.message);
    }
  }

  /**
   * Gather comprehensive user data from all sources
   */
  async gatherUserData(userId) {
    const [
      profile,
      identity,
      conversationSummary,
      recentInteractions
    ] = await Promise.all([
      persistentMemory.getUserProfile(userId),
      userProfileMemory.fetchIdentity(userId).catch(() => ({})),
      persistentMemory.summarizeContext(userId).catch(() => ''),
      this.getRecentInteractions(userId)
    ]);

    return {
      profile,
      identity,
      conversationSummary,
      recentInteractions,
      dataQuality: this.assessDataQuality(profile, recentInteractions)
    };
  }

  /**
   * Analyze learning patterns and preferences
   */
  async analyzeLearningPatterns(userData) {
    const { profile, recentInteractions, conversationSummary } = userData;

    const analysisPrompt = `Analyze this learner's patterns and generate deep learning insights.

USER PROFILE:
${JSON.stringify({
  learning: profile.learning,
  communication: profile.communication,
  emotional: profile.emotional,
  topics: profile.topics,
  stats: profile.stats
}, null, 2)}

RECENT INTERACTIONS:
${recentInteractions.slice(0, 10).map(i => `- ${i.type}: ${i.summary}`).join('\n')}

CONVERSATION SUMMARY:
${conversationSummary}

Analyze and provide detailed JSON insights:
{
  "learningStyle": {
    "primary": "visual|auditory|kinesthetic|reading|multimodal",
    "secondary": "backup learning style",
    "confidence": 0.8,
    "indicators": ["evidence1", "evidence2"],
    "adaptations_needed": ["adaptation1", "adaptation2"]
  },
  "cognitivePreferences": {
    "processingSpeed": "fast|medium|slow",
    "informationDepth": "surface|medium|deep",
    "conceptualThinking": "concrete|abstract|mixed",
    "problemSolvingApproach": "analytical|intuitive|systematic|creative",
    "memoryStrengths": ["working|long-term|associative|procedural"],
    "attentionPatterns": "focused|distributed|variable"
  },
  "motivationalFactors": {
    "intrinsicMotivators": ["curiosity", "mastery", "autonomy", "purpose"],
    "extrinsicMotivators": ["achievement", "recognition", "progress", "competition"],
    "discouragement_triggers": ["frustration", "boredom", "complexity"],
    "engagement_sustainers": ["variety", "challenge", "support", "relevance"],
    "optimal_challenge_level": "easy|moderate|difficult|variable"
  },
  "socialLearningPreferences": {
    "collaboration_preference": "independent|small_group|large_group|mixed",
    "feedback_preference": "immediate|delayed|detailed|brief",
    "authority_relationship": "formal|informal|peer|mentor",
    "communication_style": "direct|indirect|encouraging|challenging"
  },
  "metacognitive_skills": {
    "self_awareness": "low|medium|high",
    "strategy_knowledge": "limited|developing|advanced",
    "self_regulation": "weak|moderate|strong",
    "reflection_tendency": "rarely|sometimes|frequently"
  },
  "emotional_learning_profile": {
    "stress_response": "fight|flight|freeze|approach",
    "confidence_patterns": "stable|variable|low|high",
    "frustration_tolerance": "low|medium|high",
    "perfectionism_level": "low|moderate|high",
    "growth_mindset": "fixed|developing|growth"
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(analysisPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error analyzing learning patterns:', error);
      // Return basic fallback analysis
      return this.generateFallbackLearningAnalysis(profile);
    }
  }

  /**
   * Map current knowledge state and identify gaps/strengths
   */
  async mapKnowledgeState(userData, contextData) {
    const { profile } = userData;
    const currentLesson = contextData.currentLesson;

    const mappingPrompt = `Map this learner's knowledge state in space science and identify specific gaps and strengths.

USER KNOWLEDGE DATA:
- Preferred Topics: ${profile.learning?.preferredTopics?.join(', ') || 'None identified'}
- Struggling Topics: ${profile.learning?.strugglingTopics?.join(', ') || 'None identified'}
- Mastered Concepts: ${profile.learning?.masteredConcepts?.join(', ') || 'None identified'}
- Recent Topic Interests: ${profile.topics?.recentTopics?.join(', ') || 'None'}
- Topic Knowledge Scores: ${JSON.stringify(profile.topics?.knowledge || {})}

${currentLesson ? `CURRENT LESSON CONTEXT: ${JSON.stringify(currentLesson)}` : ''}

CRITICAL: Return ONLY valid JSON. No markdown, no extra text, no comments.

Generate a comprehensive knowledge mapping as valid JSON:
{
  "knowledge_areas": {
    "physics": {
      "mechanics": {"level": 0.7, "confidence": 0.8, "gaps": ["rotational dynamics"], "strengths": ["linear motion"]},
      "thermodynamics": {"level": 0.3, "confidence": 0.6, "gaps": ["entropy"], "strengths": ["temperature"]},
      "electromagnetism": {"level": 0.5, "confidence": 0.7, "gaps": ["magnetic fields"], "strengths": ["basic circuits"]}
    },
    "astronomy": {
      "planetary_science": {"level": 0.6, "confidence": 0.9, "gaps": ["atmospheric dynamics"], "strengths": ["orbital mechanics"]},
      "stellar_physics": {"level": 0.4, "confidence": 0.5, "gaps": ["nuclear fusion"], "strengths": ["star classification"]},
      "cosmology": {"level": 0.2, "confidence": 0.3, "gaps": ["dark matter"], "strengths": ["big bang basics"]}
    },
    "engineering": {
      "spacecraft_design": {"level": 0.5, "confidence": 0.6, "gaps": ["propulsion systems"], "strengths": ["structural basics"]},
      "life_support": {"level": 0.3, "confidence": 0.4, "gaps": ["oxygen recycling"], "strengths": ["basic needs"]},
      "navigation": {"level": 0.4, "confidence": 0.5, "gaps": ["orbital transfers"], "strengths": ["coordinate systems"]}
    }
  },
  "critical_gaps": ["gap1", "gap2", "gap3"],
  "foundation_strengths": ["strength1", "strength2"],
  "zone_of_proximal_development": ["concept1", "concept2"],
  "prerequisite_map": {
    "advanced_concept": ["basic_concept1", "basic_concept2"]
  },
  "learning_readiness": {
    "ready_to_learn": ["ready_concept1", "ready_concept2"],
    "needs_preparation": ["prep_concept1"],
    "too_advanced": ["advanced_concept1"]
  },
  "personalized_pathway": ["step1", "step2", "step3"]
}

ENSURE: All arrays end with proper commas, all objects are properly closed, no trailing commas.`;

    try {
      const response = await aiProviderManager.generateResponse(mappingPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error mapping knowledge state:', error);
      return this.generateFallbackKnowledgeMapping(profile);
    }
  }

  /**
   * Build comprehensive cognitive profile
   */
  async buildCognitiveProfile(userData, learningAnalysis) {
    const { profile, recentInteractions } = userData;

    const cognitivePrompt = `Build a detailed cognitive profile for this learner based on their interactions and patterns.

LEARNING ANALYSIS:
${JSON.stringify(learningAnalysis, null, 2)}

INTERACTION PATTERNS:
${recentInteractions.slice(0, 15).map(i => 
  `- ${i.timestamp}: ${i.type} - ${i.summary} (engagement: ${i.engagement_level})`
).join('\n')}

USER STATS:
- Total Interactions: ${profile.stats?.totalInteractions || 0}
- Average Session Length: ${profile.stats?.averageSessionLength || 0}
- Current Session Interactions: ${profile.stats?.currentSessionInteractions || 0}

Generate comprehensive cognitive profile:
{
  "cognitive_strengths": {
    "information_processing": ["visual", "sequential", "analytical"],
    "memory_systems": ["working_memory", "long_term_recall", "pattern_recognition"],
    "thinking_styles": ["logical", "creative", "systematic", "intuitive"],
    "problem_solving": ["decomposition", "abstraction", "debugging", "optimization"]
  },
  "cognitive_challenges": {
    "processing_bottlenecks": ["working_memory", "attention", "speed"],
    "learning_barriers": ["misconceptions", "gaps", "motivation"],
    "support_needs": ["scaffolding", "examples", "practice", "feedback"]
  },
  "optimal_conditions": {
    "cognitive_load": "low|moderate|high",
    "information_chunking": "small|medium|large",
    "scaffolding_level": "heavy|moderate|minimal",
    "feedback_frequency": "immediate|frequent|periodic",
    "practice_distribution": "massed|spaced|interleaved"
  },
  "adaptation_strategies": {
    "when_struggling": ["strategy1", "strategy2"],
    "when_bored": ["strategy1", "strategy2"],
    "when_confident": ["strategy1", "strategy2"],
    "when_frustrated": ["strategy1", "strategy2"]
  },
  "learning_progression": {
    "current_capacity": "what they can handle now",
    "next_challenge": "what to introduce next",
    "growth_trajectory": "predicted learning path",
    "milestone_indicators": ["signs of progress"]
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(cognitivePrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error building cognitive profile:', error);
      return this.generateFallbackCognitiveProfile();
    }
  }

  /**
   * Generate adaptive strategies based on all analysis
   */
  async generateAdaptiveStrategies(userData, learningAnalysis, knowledgeMapping, cognitiveProfile) {
    const strategiesPrompt = `Generate specific adaptive strategies for personalizing this learner's experience.

LEARNING ANALYSIS:
${JSON.stringify(learningAnalysis.learningStyle, null, 2)}
${JSON.stringify(learningAnalysis.motivationalFactors, null, 2)}

KNOWLEDGE STATE:
Critical Gaps: ${knowledgeMapping.critical_gaps?.join(', ') || 'None identified'}
Foundation Strengths: ${knowledgeMapping.foundation_strengths?.join(', ') || 'None identified'}
Ready to Learn: ${knowledgeMapping.learning_readiness?.ready_to_learn?.join(', ') || 'None identified'}

COGNITIVE PROFILE:
Strengths: ${cognitiveProfile.cognitive_strengths?.information_processing?.join(', ') || 'None identified'}
Challenges: ${cognitiveProfile.cognitive_challenges?.processing_bottlenecks?.join(', ') || 'None identified'}
Optimal Conditions: ${JSON.stringify(cognitiveProfile.optimal_conditions || {})}

Generate adaptive strategies:
{
  "content_adaptation": {
    "difficulty_scaling": {
      "current_level": "beginner|intermediate|advanced",
      "adjustment_rules": ["when to increase", "when to decrease"],
      "progression_indicators": ["signs to move forward"]
    },
    "presentation_style": {
      "primary_modality": "visual|auditory|kinesthetic|text",
      "supporting_modalities": ["secondary", "tertiary"],
      "narrative_elements": ["story", "scenarios", "examples"],
      "interaction_types": ["quiz", "simulation", "discussion", "hands-on"]
    },
    "pacing_strategy": {
      "information_delivery": "fast|moderate|slow|adaptive",
      "break_intervals": "frequent|moderate|minimal",
      "review_frequency": "high|medium|low",
      "practice_distribution": "concentrated|spaced|mixed"
    }
  },
  "engagement_optimization": {
    "motivation_triggers": {
      "curiosity_hooks": ["specific elements that spark interest"],
      "achievement_milestones": ["meaningful progress markers"],
      "autonomy_elements": ["choices and control opportunities"],
      "relevance_connections": ["real-world applications"]
    },
    "attention_management": {
      "focus_duration": "optimal attention span in minutes",
      "variety_injection": "when and how to change activities",
      "energy_monitoring": "signs of fatigue or overload",
      "re-engagement_tactics": ["strategies to regain attention"]
    }
  },
  "support_scaffolding": {
    "cognitive_supports": {
      "working_memory_aids": ["external memory", "chunking", "organization"],
      "comprehension_supports": ["examples", "analogies", "visualizations"],
      "metacognitive_prompts": ["self-reflection", "strategy awareness"],
      "error_prevention": ["anticipating misconceptions"]
    },
    "emotional_supports": {
      "confidence_building": ["success experiences", "positive feedback"],
      "frustration_management": ["break strategies", "alternative approaches"],
      "stress_reduction": ["calming techniques", "pressure relief"],
      "growth_mindset": ["learning from mistakes", "effort recognition"]
    }
  },
  "assessment_adaptation": {
    "formative_assessment": {
      "frequency": "continuous|frequent|periodic",
      "formats": ["multiple choice", "open-ended", "practical"],
      "feedback_style": "immediate|delayed|detailed|brief",
      "difficulty_adaptation": "real-time adjustment rules"
    },
    "progress_monitoring": {
      "success_indicators": ["what shows understanding"],
      "struggle_signals": ["what indicates difficulty"],
      "intervention_triggers": ["when to provide help"],
      "mastery_criteria": ["what demonstrates competence"]
    }
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(strategiesPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error generating adaptive strategies:', error);
      return this.generateFallbackAdaptiveStrategies();
    }
  }

  /**
   * Generate specific personalization recommendations
   */
  async generatePersonalizationRecommendations(learningAnalysis, knowledgeMapping, cognitiveProfile) {
    return {
      immediate_actions: [
        "Adjust lesson difficulty based on knowledge gaps",
        "Use preferred learning modality in explanations",
        "Provide cognitive supports for identified challenges",
        "Incorporate motivational elements from profile"
      ],
      lesson_customizations: [
        "Start with strength areas to build confidence",
        "Address critical gaps with targeted exercises",
        "Use optimal pacing for this learner's attention span",
        "Include engagement hooks from motivational profile"
      ],
      tutoring_approach: [
        "Apply Socratic questioning at appropriate level",
        "Use scaffolding strategy from cognitive profile",
        "Monitor for struggle signals and adapt",
        "Provide feedback in preferred style and frequency"
      ],
      content_priorities: [
        "Focus on zone of proximal development concepts",
        "Connect new learning to identified strengths",
        "Use real-world examples relevant to interests",
        "Sequence content according to prerequisite map"
      ]
    };
  }

  /**
   * Get recent user interactions for analysis
   */
  async getRecentInteractions(userId) {
    try {
      // This would typically pull from a database of user interactions
      // For now, we'll simulate based on the profile data
      const profile = await persistentMemory.getUserProfile(userId);
      
      return [
        {
          timestamp: new Date().toISOString(),
          type: 'lesson_interaction',
          summary: 'Completed space exploration lesson block',
          engagement_level: 'high',
          performance: 'good'
        },
        // Add more simulated interactions...
      ];
    } catch (error) {
      console.error('Error getting recent interactions:', error);
      return [];
    }
  }

  /**
   * Assess quality of available data for personalization
   */
  assessDataQuality(profile, recentInteractions) {
    let score = 0;
    let factors = [];

    // Profile completeness
    if (profile.stats?.totalInteractions > 10) {
      score += 0.3;
      factors.push('sufficient_interaction_history');
    }
    if (profile.learning?.preferredTopics?.length > 0) {
      score += 0.2;
      factors.push('identified_interests');
    }
    if (profile.learning?.strugglingTopics?.length > 0) {
      score += 0.2;
      factors.push('known_weaknesses');
    }
    
    // Recent data availability
    if (recentInteractions.length > 5) {
      score += 0.2;
      factors.push('recent_activity');
    }
    
    // Profile age and currency
    const profileAge = Date.now() - new Date(profile.createdAt).getTime();
    if (profileAge > 7 * 24 * 60 * 60 * 1000) { // 7 days
      score += 0.1;
      factors.push('established_profile');
    }

    return {
      score: Math.min(score, 1.0),
      factors,
      recommendation: score > 0.7 ? 'high_confidence' : score > 0.4 ? 'moderate_confidence' : 'low_confidence'
    };
  }

  /**
   * Calculate overall confidence in personalization recommendations
   */
  calculateConfidenceScore(userData, learningAnalysis) {
    const dataQuality = userData.dataQuality.score;
    const analysisDepth = Object.keys(learningAnalysis).length / 6; // Expected number of analysis areas
    const interactionHistory = Math.min(userData.profile.stats?.totalInteractions || 0, 50) / 50;
    
    return Math.min((dataQuality + analysisDepth + interactionHistory) / 3, 1.0);
  }

  /**
   * Cache management
   */
  cacheInsights(userId, insights) {
    this.userInsightsCache.set(userId, {
      insights,
      timestamp: Date.now()
    });
  }

  getCachedInsights(userId) {
    const cached = this.userInsightsCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.insights;
    }
    return null;
  }

  /**
   * Fallback methods for when AI generation fails
   */
  generateFallbackLearningAnalysis(profile) {
    return {
      learningStyle: {
        primary: profile.learning?.preferredStyle || 'multimodal',
        confidence: 0.5,
        indicators: ['limited_data'],
        adaptations_needed: ['gather_more_data']
      },
      cognitivePreferences: {
        processingSpeed: 'medium',
        informationDepth: 'medium',
        conceptualThinking: 'mixed',
        problemSolvingApproach: 'systematic'
      },
      motivationalFactors: {
        intrinsicMotivators: ['curiosity', 'mastery'],
        optimal_challenge_level: 'moderate'
      }
    };
  }

  generateFallbackKnowledgeMapping(profile) {
    return {
      knowledge_areas: {},
      critical_gaps: profile.learning?.strugglingTopics || [],
      foundation_strengths: profile.learning?.preferredTopics || [],
      zone_of_proximal_development: ['basic_concepts'],
      learning_readiness: {
        ready_to_learn: ['fundamental_concepts'],
        needs_preparation: [],
        too_advanced: ['advanced_topics']
      }
    };
  }

  generateFallbackCognitiveProfile() {
    return {
      cognitive_strengths: {
        information_processing: ['visual'],
        thinking_styles: ['logical']
      },
      optimal_conditions: {
        cognitive_load: 'moderate',
        scaffolding_level: 'moderate',
        feedback_frequency: 'frequent'
      }
    };
  }

  generateFallbackAdaptiveStrategies() {
    return {
      content_adaptation: {
        difficulty_scaling: {
          current_level: 'beginner',
          adjustment_rules: ['gradual_progression']
        },
        presentation_style: {
          primary_modality: 'multimodal'
        }
      },
      engagement_optimization: {
        motivation_triggers: {
          curiosity_hooks: ['space_exploration_examples']
        }
      }
    };
  }
}

// Create singleton instance
const enhancedPersonalizationEngine = new EnhancedPersonalizationEngine();

module.exports = { enhancedPersonalizationEngine };
