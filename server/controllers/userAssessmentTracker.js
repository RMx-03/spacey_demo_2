const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { parseAIJSONResponse, fixCommonJSONIssues } = require('../utils/jsonParser');

// Remove local helpers; using shared utils/jsonParser

/**
 * User Assessment Tracker - Real-time assessment and knowledge gap identification
 * Continuously monitors user understanding and adapts learning experience
 */
class UserAssessmentTracker {
  constructor() {
    this.assessmentCache = new Map(); // userId -> assessment data
    this.knowledgeGaps = new Map(); // userId -> identified gaps
    this.masteryTracking = new Map(); // userId -> mastery progress
    this.realTimeAssessments = new Map(); // userId -> current assessment state
  }

  /**
   * Perform real-time assessment based on user interaction
   * @param {string} userId - User identifier
   * @param {Object} interactionData - User interaction data
   * @returns {Promise<Object>} Assessment results and recommendations
   */
  async performRealTimeAssessment(userId, interactionData) {
    console.log(`📊 Performing real-time assessment for user ${userId}`);

    try {
      // 1. Analyze the current interaction
      const interactionAnalysis = await this.analyzeInteraction(userId, interactionData);
      
      // 2. Update knowledge state tracking
      const knowledgeUpdate = await this.updateKnowledgeState(userId, interactionAnalysis);
      
      // 3. Identify emerging gaps or mastery
      const gapAnalysis = await this.identifyKnowledgeGaps(userId, knowledgeUpdate);
      
      // 4. Generate adaptive recommendations
      const adaptiveRecommendations = await this.generateAdaptiveRecommendations(userId, gapAnalysis);
      
      // 5. Determine intervention needs
      const interventionNeeds = await this.assessInterventionNeeds(userId, gapAnalysis, interactionAnalysis);

      const assessment = {
        userId,
        timestamp: new Date().toISOString(),
        interactionAnalysis,
        knowledgeUpdate,
        gapAnalysis,
        adaptiveRecommendations,
        interventionNeeds,
        confidenceScore: this.calculateAssessmentConfidence(interactionAnalysis, knowledgeUpdate)
      };

      // Cache the assessment
      this.updateAssessmentCache(userId, assessment);
      
      return assessment;

    } catch (error) {
      console.error('❌ Error in real-time assessment:', error);
      throw new Error('Failed to perform real-time assessment: ' + error.message);
    }
  }

  /**
   * Analyze user interaction for understanding signals
   */
  async analyzeInteraction(userId, interactionData) {
    const {
      userResponse,
      responseTime,
      questionType,
      expectedAnswer,
      lessonContext,
      previousAttempts,
      hintUsage
    } = interactionData;

    const analysisPrompt = `Analyze this user interaction for understanding and knowledge signals.

USER INTERACTION:
Response: "${userResponse}"
Response Time: ${responseTime}ms
Question Type: ${questionType}
Expected Answer: ${expectedAnswer ? `"${expectedAnswer}"` : 'Open-ended'}
Previous Attempts: ${previousAttempts || 0}
Hints Used: ${hintUsage || 0}

LESSON CONTEXT:
${lessonContext ? JSON.stringify(lessonContext, null, 2) : 'No lesson context provided'}

Analyze and provide detailed assessment:
{
  "understanding_indicators": {
    "comprehension_level": "none|partial|good|excellent",
    "confidence_indicators": ["specific_signals_of_confidence"],
    "confusion_signals": ["specific_signs_of_confusion"],
    "mastery_evidence": ["evidence_of_understanding"],
    "misconception_indicators": ["signs_of_misconceptions"]
  },
  "cognitive_assessment": {
    "processing_speed": "slow|normal|fast",
    "working_memory_usage": "low|moderate|high|overloaded",
    "attention_focus": "unfocused|variable|focused|deep",
    "metacognitive_awareness": "low|developing|good|high",
    "problem_solving_approach": "random|systematic|creative|analytical"
  },
  "knowledge_state": {
    "concepts_demonstrated": ["concept1", "concept2"],
    "skills_shown": ["skill1", "skill2"],
    "gaps_revealed": ["gap1", "gap2"],
    "misconceptions_detected": ["misconception1", "misconception2"],
    "transfer_ability": "none|limited|good|strong"
  },
  "engagement_assessment": {
    "motivation_level": "low|moderate|high",
    "persistence": "gives_up|tries_briefly|persists|determined",
    "curiosity_indicators": ["signs_of_curiosity"],
    "frustration_level": "none|mild|moderate|high",
    "enjoyment_signals": ["signs_of_enjoyment"]
  },
  "learning_readiness": {
    "ready_for_next_concept": true/false,
    "needs_more_practice": true/false,
    "requires_remediation": true/false,
    "can_handle_challenge": true/false,
    "optimal_next_step": "continue|practice|review|advance|redirect"
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(analysisPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error analyzing interaction:', error);
      return this.generateFallbackInteractionAnalysis(interactionData);
    }
  }

  /**
   * Update knowledge state based on assessment
   */
  async updateKnowledgeState(userId, interactionAnalysis) {
    const currentKnowledge = this.masteryTracking.get(userId) || {
      concepts: {},
      skills: {},
      misconceptions: {},
      lastUpdated: new Date().toISOString()
    };

    const updatePrompt = `Update the user's knowledge state based on this interaction analysis.

CURRENT KNOWLEDGE STATE:
${JSON.stringify(currentKnowledge, null, 2)}

INTERACTION ANALYSIS:
Concepts Demonstrated: ${interactionAnalysis.knowledge_state?.concepts_demonstrated?.join(', ') || 'none'}
Skills Shown: ${interactionAnalysis.knowledge_state?.skills_shown?.join(', ') || 'none'}
Gaps Revealed: ${interactionAnalysis.knowledge_state?.gaps_revealed?.join(', ') || 'none'}
Misconceptions: ${interactionAnalysis.knowledge_state?.misconceptions_detected?.join(', ') || 'none'}
Comprehension Level: ${interactionAnalysis.understanding_indicators?.comprehension_level}

Generate updated knowledge state:
{
  "concept_mastery": {
    "concept_name": {
      "mastery_level": 0.0-1.0,
      "confidence": 0.0-1.0,
      "last_demonstrated": "timestamp",
      "evidence_count": number,
      "progression_trend": "improving|stable|declining"
    }
  },
  "skill_proficiency": {
    "skill_name": {
      "proficiency_level": 0.0-1.0,
      "consistency": 0.0-1.0,
      "last_used": "timestamp",
      "success_rate": 0.0-1.0,
      "difficulty_handled": "basic|intermediate|advanced"
    }
  },
  "misconception_tracking": {
    "misconception_description": {
      "strength": 0.0-1.0,
      "persistence": "resolved|weakening|stable|strengthening",
      "interventions_tried": ["intervention1", "intervention2"],
      "last_observed": "timestamp"
    }
  },
  "knowledge_gaps": {
    "gap_description": {
      "severity": "minor|moderate|major|critical",
      "impact_on_learning": "low|medium|high",
      "prerequisite_chain": ["prerequisite1", "prerequisite2"],
      "remediation_priority": 1-10
    }
  },
  "overall_progress": {
    "learning_velocity": "slow|steady|fast",
    "retention_strength": "weak|moderate|strong",
    "transfer_ability": "limited|developing|good|excellent",
    "independence_level": "dependent|guided|semi_independent|independent"
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(updatePrompt, 'gemini');
      const updatedKnowledge = parseAIJSONResponse(response);
      
      // Update tracking
      this.masteryTracking.set(userId, {
        ...updatedKnowledge,
        lastUpdated: new Date().toISOString(),
        updateCount: (currentKnowledge.updateCount || 0) + 1
      });
      
      return updatedKnowledge;
    } catch (error) {
      console.error('Error updating knowledge state:', error);
      return this.generateFallbackKnowledgeUpdate(currentKnowledge, interactionAnalysis);
    }
  }

  /**
   * Identify critical knowledge gaps and prioritize them
   */
  async identifyKnowledgeGaps(userId, knowledgeUpdate) {
    const existingGaps = this.knowledgeGaps.get(userId) || {};
    
    const gapAnalysisPrompt = `Analyze knowledge gaps and prioritize intervention needs.

UPDATED KNOWLEDGE STATE:
${JSON.stringify(knowledgeUpdate, null, 2)}

EXISTING GAPS TRACKING:
${JSON.stringify(existingGaps, null, 2)}

Provide comprehensive gap analysis:
{
  "critical_gaps": [
    {
      "gap_id": "unique_identifier",
      "description": "what the learner is missing",
      "severity": "minor|moderate|major|critical",
      "impact_areas": ["areas_affected"],
      "blocking_progress": true/false,
      "prerequisite_for": ["future_concepts"],
      "remediation_urgency": "immediate|soon|moderate|low",
      "estimated_remediation_time": "minutes_needed"
    }
  ],
  "emerging_gaps": [
    {
      "early_indicator": "what we're starting to see",
      "potential_severity": "if_not_addressed",
      "prevention_strategy": "how_to_prevent",
      "monitoring_indicators": ["what_to_watch_for"]
    }
  ],
  "misconception_patterns": [
    {
      "misconception": "incorrect_understanding",
      "root_cause": "why_this_developed",
      "manifestations": ["how_it_shows_up"],
      "correction_strategy": "how_to_address",
      "difficulty_level": "easy|moderate|hard|very_hard"
    }
  ],
  "strengths_to_leverage": [
    {
      "strength_area": "what_they_do_well",
      "confidence_level": 0.0-1.0,
      "transfer_potential": ["where_this_helps"],
      "scaffolding_value": "how_to_use_as_bridge"
    }
  ],
  "intervention_priorities": [
    {
      "priority_rank": 1-10,
      "intervention_type": "remediation|practice|clarification|enrichment",
      "target_gap": "gap_id",
      "success_criteria": ["how_to_know_if_successful"],
      "estimated_impact": "high|medium|low"
    }
  ]
}`;

    try {
      const response = await aiProviderManager.generateResponse(gapAnalysisPrompt, 'gemini');
      const gapAnalysis = parseAIJSONResponse(response);
      
      // Update gap tracking
      this.knowledgeGaps.set(userId, {
        ...gapAnalysis,
        lastAnalyzed: new Date().toISOString(),
        analysisCount: (existingGaps.analysisCount || 0) + 1
      });
      
      return gapAnalysis;
    } catch (error) {
      console.error('Error identifying knowledge gaps:', error);
      return this.generateFallbackGapAnalysis(knowledgeUpdate);
    }
  }

  /**
   * Generate adaptive recommendations based on assessment
   */
  async generateAdaptiveRecommendations(userId, gapAnalysis) {
    const personalizationInsights = await enhancedPersonalizationEngine.generatePersonalizationInsights(userId);
    
    const recommendationsPrompt = `Generate adaptive learning recommendations based on gap analysis and personalization.

GAP ANALYSIS:
${JSON.stringify(gapAnalysis, null, 2)}

PERSONALIZATION INSIGHTS:
Learning Style: ${personalizationInsights.learningAnalysis?.learningStyle?.primary}
Cognitive Profile: ${JSON.stringify(personalizationInsights.cognitiveProfile?.optimal_conditions)}
Motivational Factors: ${JSON.stringify(personalizationInsights.learningAnalysis?.motivationalFactors)}

Generate personalized recommendations:
{
  "immediate_actions": [
    {
      "action_type": "clarification|practice|remediation|advancement|break",
      "description": "what_to_do_now",
      "rationale": "why_this_is_needed",
      "implementation": "how_to_execute",
      "expected_outcome": "what_this_should_achieve",
      "success_indicators": ["how_to_know_if_working"]
    }
  ],
  "content_adaptations": {
    "difficulty_adjustments": {
      "current_level": "too_easy|appropriate|too_hard",
      "recommended_change": "increase|decrease|maintain",
      "adjustment_magnitude": "small|moderate|large"
    },
    "presentation_modifications": {
      "modality_emphasis": "visual|auditory|kinesthetic|text",
      "pacing_changes": "slower|same|faster",
      "scaffolding_level": "more|same|less",
      "example_types": ["concrete", "abstract", "analogies"]
    },
    "engagement_enhancements": {
      "motivation_boosters": ["specific_strategies"],
      "curiosity_triggers": ["elements_to_add"],
      "challenge_calibration": "reduce|maintain|increase",
      "autonomy_opportunities": ["choices_to_offer"]
    }
  },
  "learning_path_adjustments": {
    "prerequisite_review": ["concepts_to_revisit"],
    "concept_sequencing": ["optimal_order"],
    "practice_opportunities": ["skills_to_practice"],
    "extension_activities": ["enrichment_options"]
  },
  "monitoring_strategies": {
    "checkpoints": ["when_to_assess_again"],
    "warning_signals": ["what_indicates_struggle"],
    "success_indicators": ["signs_of_progress"],
    "adaptation_triggers": ["when_to_change_approach"]
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(recommendationsPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error generating adaptive recommendations:', error);
      return this.generateFallbackRecommendations();
    }
  }

  /**
   * Assess if immediate intervention is needed
   */
  async assessInterventionNeeds(userId, gapAnalysis, interactionAnalysis) {
    const frustrationLevel = interactionAnalysis.engagement_assessment?.frustration_level;
    const comprehensionLevel = interactionAnalysis.understanding_indicators?.comprehension_level;
    const criticalGaps = gapAnalysis.critical_gaps?.filter(gap => gap.severity === 'critical') || [];
    
    const interventionNeeds = {
      immediate_intervention_required: false,
      intervention_type: null,
      urgency_level: 'none',
      recommended_actions: [],
      reasoning: ''
    };

    // Check for immediate intervention needs
    if (frustrationLevel === 'high' || comprehensionLevel === 'none') {
      interventionNeeds.immediate_intervention_required = true;
      interventionNeeds.urgency_level = 'high';
      interventionNeeds.intervention_type = 'support';
      interventionNeeds.recommended_actions = [
        'Provide immediate encouragement',
        'Simplify current content',
        'Offer alternative explanations',
        'Consider taking a break'
      ];
      interventionNeeds.reasoning = 'High frustration or lack of comprehension detected';
    } else if (criticalGaps.length > 0) {
      interventionNeeds.immediate_intervention_required = true;
      interventionNeeds.urgency_level = 'medium';
      interventionNeeds.intervention_type = 'remediation';
      interventionNeeds.recommended_actions = [
        'Address critical knowledge gaps',
        'Provide targeted remediation',
        'Check prerequisites'
      ];
      interventionNeeds.reasoning = 'Critical knowledge gaps are blocking progress';
    } else if (comprehensionLevel === 'excellent' && interactionAnalysis.engagement_assessment?.motivation_level === 'high') {
      interventionNeeds.immediate_intervention_required = true;
      interventionNeeds.urgency_level = 'low';
      interventionNeeds.intervention_type = 'enrichment';
      interventionNeeds.recommended_actions = [
        'Provide additional challenges',
        'Introduce advanced concepts',
        'Offer extension activities'
      ];
      interventionNeeds.reasoning = 'Learner is ready for increased challenge';
    }

    return interventionNeeds;
  }

  /**
   * Get current assessment summary for a user
   */
  getCurrentAssessment(userId) {
    return this.assessmentCache.get(userId) || null;
  }

  /**
   * Get knowledge gap summary for a user
   */
  getKnowledgeGaps(userId) {
    return this.knowledgeGaps.get(userId) || {};
  }

  /**
   * Get mastery tracking for a user
   */
  getMasteryTracking(userId) {
    return this.masteryTracking.get(userId) || {};
  }

  /**
   * Calculate confidence in assessment results
   */
  calculateAssessmentConfidence(interactionAnalysis, knowledgeUpdate) {
    let confidence = 0;
    
    // Response quality indicators
    if (interactionAnalysis.understanding_indicators?.comprehension_level !== 'none') confidence += 0.3;
    if (interactionAnalysis.cognitive_assessment?.attention_focus === 'focused') confidence += 0.2;
    
    // Knowledge update quality
    const conceptCount = Object.keys(knowledgeUpdate.concept_mastery || {}).length;
    confidence += Math.min(conceptCount * 0.1, 0.3);
    
    // Interaction richness
    if (interactionAnalysis.knowledge_state?.concepts_demonstrated?.length > 0) confidence += 0.2;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Update assessment cache
   */
  updateAssessmentCache(userId, assessment) {
    this.assessmentCache.set(userId, {
      ...assessment,
      cached_at: Date.now()
    });
    
    // Clean old cache entries
    for (const [id, cached] of this.assessmentCache.entries()) {
      if (Date.now() - cached.cached_at > 30 * 60 * 1000) { // 30 minutes
        this.assessmentCache.delete(id);
      }
    }
  }

  /**
   * Fallback methods for error conditions
   */
  generateFallbackInteractionAnalysis(interactionData) {
    return {
      understanding_indicators: {
        comprehension_level: 'partial',
        confidence_indicators: ['user_responded'],
        confusion_signals: [],
        mastery_evidence: [],
        misconception_indicators: []
      },
      cognitive_assessment: {
        processing_speed: 'normal',
        attention_focus: 'variable',
        metacognitive_awareness: 'developing'
      },
      knowledge_state: {
        concepts_demonstrated: [],
        gaps_revealed: [],
        misconceptions_detected: []
      },
      engagement_assessment: {
        motivation_level: 'moderate',
        frustration_level: 'mild'
      },
      learning_readiness: {
        optimal_next_step: 'continue'
      }
    };
  }

  generateFallbackKnowledgeUpdate(currentKnowledge, interactionAnalysis) {
    return {
      concept_mastery: currentKnowledge.concepts || {},
      skill_proficiency: currentKnowledge.skills || {},
      misconception_tracking: currentKnowledge.misconceptions || {},
      knowledge_gaps: {},
      overall_progress: {
        learning_velocity: 'steady',
        retention_strength: 'moderate'
      }
    };
  }

  generateFallbackGapAnalysis(knowledgeUpdate) {
    return {
      critical_gaps: [],
      emerging_gaps: [],
      misconception_patterns: [],
      strengths_to_leverage: [],
      intervention_priorities: []
    };
  }

  generateFallbackRecommendations() {
    return {
      immediate_actions: [{
        action_type: 'continue',
        description: 'Continue with current lesson',
        rationale: 'No specific issues detected'
      }],
      content_adaptations: {
        difficulty_adjustments: {
          current_level: 'appropriate',
          recommended_change: 'maintain'
        }
      },
      learning_path_adjustments: {
        prerequisite_review: [],
        concept_sequencing: []
      }
    };
  }
}

// Create singleton instance
const userAssessmentTracker = new UserAssessmentTracker();

module.exports = { userAssessmentTracker };