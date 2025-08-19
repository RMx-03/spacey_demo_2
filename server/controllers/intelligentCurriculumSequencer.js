const { aiProviderManager } = require('./aiProviders');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { userAssessmentTracker } = require('./userAssessmentTracker');
const { persistentMemory } = require('./persistentMemory');
const { parseAIJSONResponse, fixCommonJSONIssues } = require('../utils/jsonParser');

// Remove local helpers; using shared utils/jsonParser

/**
 * Intelligent Curriculum Sequencer
 * Dynamically sequences learning content based on user's pace, style, and mastery
 */
class IntelligentCurriculumSequencer {
  constructor() {
    this.userSequences = new Map(); // userId -> current sequence state
    this.conceptDependencies = new Map(); // concept -> prerequisites
    this.adaptivePathways = new Map(); // userId -> personalized learning pathway
    this.pacingProfiles = new Map(); // userId -> pacing analysis
  }

  /**
   * Generate personalized learning sequence for a user
   * @param {string} userId - User identifier
   * @param {Object} sequenceRequest - Sequencing parameters
   * @returns {Promise<Object>} Optimized learning sequence
   */
  async generatePersonalizedSequence(userId, sequenceRequest) {
    console.log(`🎯 Generating personalized curriculum sequence for user ${userId}`);

    try {
      // 1. Get comprehensive user insights
      const personalizationInsights = await enhancedPersonalizationEngine.generatePersonalizationInsights(userId);
      
      // 2. Analyze current knowledge state and gaps
      const currentAssessment = userAssessmentTracker.getCurrentAssessment(userId);
      const knowledgeGaps = userAssessmentTracker.getKnowledgeGaps(userId);
      const masteryTracking = userAssessmentTracker.getMasteryTracking(userId);
      
      // 3. Analyze learning pace and preferences
      const pacingAnalysis = await this.analyzeLearningPace(userId, personalizationInsights);
      
      // 4. Build concept dependency map
      const dependencyMap = await this.buildConceptDependencyMap(sequenceRequest.domain || 'space_science');
      
      // 5. Generate optimal sequence
      const optimizedSequence = await this.generateOptimalSequence(
        userId,
        sequenceRequest,
        personalizationInsights,
        currentAssessment,
        knowledgeGaps,
        pacingAnalysis,
        dependencyMap
      );
      
      // 6. Apply adaptive branching strategies
      const adaptiveSequence = await this.applyAdaptiveBranching(userId, optimizedSequence, personalizationInsights);
      
      // 7. Cache the sequence
      this.cacheUserSequence(userId, adaptiveSequence);
      
      return adaptiveSequence;

    } catch (error) {
      console.error('❌ Error generating personalized sequence:', error);
      throw new Error('Failed to generate personalized sequence: ' + error.message);
    }
  }

  /**
   * Analyze user's learning pace and patterns
   */
  async analyzeLearningPace(userId, personalizationInsights) {
    const userProfile = await persistentMemory.getUserProfile(userId);
    
    const pacingPrompt = `Analyze this learner's pace and patterns to optimize curriculum sequencing.

USER PROFILE:
Learning Style: ${personalizationInsights.learningAnalysis?.learningStyle?.primary}
Cognitive Profile: ${JSON.stringify(personalizationInsights.cognitiveProfile?.optimal_conditions)}
Stats: ${JSON.stringify(userProfile.stats)}
Communication: ${JSON.stringify(userProfile.communication)}
Learning History: ${JSON.stringify(userProfile.learning)}

PERSONALIZATION INSIGHTS:
Attention Span: ${personalizationInsights.learningAnalysis?.cognitivePreferences?.attentionPatterns}
Processing Speed: ${personalizationInsights.learningAnalysis?.cognitivePreferences?.processingSpeed}
Information Depth: ${personalizationInsights.learningAnalysis?.cognitivePreferences?.informationDepth}

Analyze learning pace and provide pacing profile:
{
  "pace_analysis": {
    "overall_learning_velocity": "slow|steady|fast|variable",
    "concept_absorption_rate": "slow|moderate|quick|instant",
    "skill_development_speed": "gradual|steady|rapid",
    "retention_strength": "needs_review|stable|strong|excellent",
    "plateau_patterns": ["when_learning_slows"],
    "acceleration_triggers": ["what_speeds_up_learning"]
  },
  "optimal_pacing": {
    "content_delivery_speed": "slow|moderate|fast|adaptive",
    "concept_introduction_frequency": "one_at_time|small_groups|larger_chunks",
    "practice_distribution": "immediate|spaced|massed|mixed",
    "review_frequency": "frequent|moderate|minimal|as_needed",
    "break_timing": "frequent_short|occasional_medium|rare_long"
  },
  "engagement_patterns": {
    "sustained_attention_duration": "minutes",
    "optimal_session_length": "minutes", 
    "variety_needs": "high|moderate|low",
    "challenge_tolerance": "low|moderate|high|variable",
    "feedback_frequency_preference": "immediate|frequent|periodic|delayed"
  },
  "adaptive_factors": {
    "time_of_day_effects": "morning|afternoon|evening|no_preference",
    "cognitive_load_sensitivity": "high|moderate|low",
    "multitasking_ability": "poor|fair|good|excellent",
    "stress_impact_on_pace": "high|moderate|low|none",
    "motivation_sustainability": "short_bursts|steady|long_term"
  },
  "sequencing_preferences": {
    "prefers_linear_progression": true/false,
    "benefits_from_spiraling": true/false,
    "likes_just_in_time_learning": true/false,
    "needs_big_picture_first": true/false,
    "works_well_with_interleaving": true/false
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(pacingPrompt, 'gemini');
      const pacingAnalysis = parseAIJSONResponse(response);
      
      // Cache pacing profile
      this.pacingProfiles.set(userId, {
        ...pacingAnalysis,
        analyzed_at: new Date().toISOString()
      });
      
      return pacingAnalysis;
    } catch (error) {
      console.error('Error analyzing learning pace:', error);
      return this.generateFallbackPacingAnalysis();
    }
  }

  /**
   * Build concept dependency map for the domain
   */
  async buildConceptDependencyMap(domain) {
    const domainPrompt = `Create a comprehensive concept dependency map for ${domain} learning.

Generate a detailed concept map with prerequisites and relationships:
{
  "domain": "${domain}",
  "concept_hierarchy": {
    "foundational_concepts": [
      {
        "concept_id": "basic_physics",
        "name": "Basic Physics Principles",
        "prerequisites": [],
        "enables": ["orbital_mechanics", "thermodynamics"],
        "difficulty_level": "beginner",
        "estimated_time": "hours",
        "key_skills": ["calculation", "conceptual_understanding"]
      }
    ],
    "intermediate_concepts": [
      {
        "concept_id": "orbital_mechanics", 
        "name": "Orbital Mechanics",
        "prerequisites": ["basic_physics", "mathematics"],
        "enables": ["spacecraft_navigation", "mission_planning"],
        "difficulty_level": "intermediate",
        "estimated_time": "hours",
        "key_skills": ["mathematical_modeling", "problem_solving"]
      }
    ],
    "advanced_concepts": [
      {
        "concept_id": "mission_planning",
        "name": "Space Mission Planning",
        "prerequisites": ["orbital_mechanics", "spacecraft_systems"],
        "enables": ["mission_execution", "advanced_concepts"],
        "difficulty_level": "advanced",
        "estimated_time": "hours",
        "key_skills": ["systems_thinking", "project_management"]
      }
    ]
  },
  "learning_pathways": [
    {
      "pathway_id": "astronaut_training",
      "name": "Astronaut Training Path",
      "sequence": ["basic_physics", "human_factors", "spacecraft_systems", "mission_operations"],
      "branch_points": ["after_basics", "after_systems"],
      "optional_modules": ["advanced_physics", "leadership"]
    }
  ],
  "prerequisite_matrix": {
    "concept_a": ["prerequisite1", "prerequisite2"],
    "concept_b": ["prerequisite3"]
  },
  "mastery_criteria": {
    "concept_id": {
      "knowledge_indicators": ["what_shows_understanding"],
      "skill_demonstrations": ["what_they_can_do"],
      "application_abilities": ["how_they_apply_it"],
      "transfer_evidence": ["cross_domain_connections"]
    }
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(domainPrompt, 'gemini');
      const dependencyMap = parseAIJSONResponse(response);
      
      // Cache dependency map
      this.conceptDependencies.set(domain, dependencyMap);
      
      return dependencyMap;
    } catch (error) {
      console.error('Error building concept dependency map:', error);
      return this.generateFallbackDependencyMap(domain);
    }
  }

  /**
   * Generate optimal learning sequence based on all factors
   */
  async generateOptimalSequence(userId, request, insights, assessment, gaps, pacing, dependencies) {
    const sequencePrompt = `Generate an optimal learning sequence for this specific learner.

LEARNER PROFILE:
Learning Style: ${insights.learningAnalysis?.learningStyle?.primary}
Pacing: ${JSON.stringify(pacing.optimal_pacing)}
Current Knowledge: ${JSON.stringify(assessment?.knowledgeUpdate?.concept_mastery)}
Critical Gaps: ${gaps.critical_gaps?.map(g => g.description).join(', ') || 'none'}

SEQUENCE REQUEST:
${JSON.stringify(request, null, 2)}

CONCEPT DEPENDENCIES:
${JSON.stringify(dependencies.concept_hierarchy, null, 2)}

Generate personalized learning sequence:
{
  "sequence_metadata": {
    "sequence_id": "unique_identifier",
    "user_id": "${userId}",
    "domain": "${request.domain || 'space_science'}",
    "total_estimated_time": "hours",
    "difficulty_progression": "gentle|moderate|steep",
    "personalization_confidence": 0.0-1.0
  },
  "learning_sequence": [
    {
      "sequence_position": 1,
      "concept_id": "concept_identifier",
      "concept_name": "Human-readable name",
      "learning_objectives": ["objective1", "objective2"],
      "prerequisite_check": {
        "required_concepts": ["prerequisite1"],
        "user_readiness": "ready|needs_prep|not_ready",
        "gap_filling_needed": ["gaps_to_address"]
      },
      "content_customization": {
        "difficulty_level": "beginner|intermediate|advanced",
        "presentation_style": "visual|auditory|kinesthetic|text",
        "pacing_adjustment": "slower|normal|faster",
        "scaffolding_level": "heavy|moderate|light|minimal"
      },
      "engagement_optimization": {
        "motivation_hooks": ["curiosity_triggers"],
        "relevance_connections": ["real_world_applications"],
        "challenge_calibration": "low|moderate|high",
        "autonomy_elements": ["choices_offered"]
      },
      "assessment_strategy": {
        "formative_checkpoints": ["checkpoint1", "checkpoint2"],
        "mastery_criteria": ["what_shows_mastery"],
        "remediation_plan": "if_struggling",
        "advancement_criteria": "when_ready_for_next"
      },
      "adaptive_branching": {
        "if_struggling": "remediation_path",
        "if_mastered_quickly": "enrichment_path",
        "if_interested": "deep_dive_path",
        "if_bored": "challenge_path"
      },
      "estimated_time": "minutes",
      "next_concepts": ["concept2", "concept3"]
    }
  ],
  "branching_strategies": {
    "remediation_paths": ["alternative_explanations", "prerequisite_review"],
    "enrichment_paths": ["advanced_applications", "cross_domain_connections"],
    "interest_driven_paths": ["follow_curiosity", "project_based_learning"],
    "challenge_paths": ["accelerated_progression", "complex_problems"]
  },
  "monitoring_plan": {
    "progress_indicators": ["what_to_track"],
    "adaptation_triggers": ["when_to_adjust_sequence"],
    "success_metrics": ["how_to_measure_effectiveness"],
    "intervention_points": ["when_to_provide_help"]
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(sequencePrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error generating optimal sequence:', error);
      return this.generateFallbackSequence(userId, request);
    }
  }

  /**
   * Apply adaptive branching strategies to the sequence
   */
  async applyAdaptiveBranching(userId, sequence, insights) {
    // Add real-time adaptation logic
    const adaptiveBranches = {
      user_id: userId,
      base_sequence: sequence,
      adaptive_rules: {
        pace_adjustment: {
          too_fast: 'Add more practice and examples',
          too_slow: 'Streamline content and reduce redundancy',
          just_right: 'Continue current pacing'
        },
        difficulty_adaptation: {
          too_easy: 'Introduce challenges and extensions',
          too_hard: 'Add scaffolding and break into smaller steps',
          appropriate: 'Maintain current difficulty'
        },
        engagement_optimization: {
          low_engagement: 'Add variety and relevance connections',
          high_engagement: 'Provide autonomy and choice',
          variable_engagement: 'Monitor and adapt in real-time'
        }
      },
      branching_points: sequence.learning_sequence.map((concept, index) => ({
        position: index,
        concept_id: concept.concept_id,
        decision_factors: ['mastery_level', 'engagement', 'time_taken', 'interest_shown'],
        alternative_paths: concept.adaptive_branching
      }))
    };

    return {
      ...sequence,
      adaptive_branches
    };
  }

  /**
   * Update sequence based on real-time learning progress
   */
  async adaptSequenceInRealTime(userId, currentProgress, performanceData) {
    const currentSequence = this.userSequences.get(userId);
    if (!currentSequence) {
      throw new Error('No active sequence found for user');
    }

    const adaptationPrompt = `Adapt the learning sequence based on real-time progress data.

CURRENT SEQUENCE:
Position: ${currentProgress.currentPosition}
Concept: ${currentProgress.currentConcept}
Time Spent: ${currentProgress.timeSpent}
Mastery Level: ${currentProgress.masteryLevel}

PERFORMANCE DATA:
${JSON.stringify(performanceData, null, 2)}

SEQUENCE ADAPTATION RULES:
${JSON.stringify(currentSequence.adaptive_branches?.adaptive_rules, null, 2)}

Provide sequence adaptation:
{
  "adaptation_needed": true/false,
  "adaptation_type": "pace|difficulty|content|engagement|sequence",
  "specific_changes": {
    "next_concept": "concept_id_or_same",
    "difficulty_adjustment": "increase|decrease|maintain",
    "pacing_change": "slow_down|speed_up|maintain",
    "content_modifications": ["specific_changes"],
    "additional_support": ["scaffolding_to_add"]
  },
  "reasoning": "why_this_adaptation_is_needed",
  "expected_outcome": "what_this_should_achieve",
  "monitoring_focus": ["what_to_watch_for_next"]
}`;

    try {
      const response = await aiProviderManager.generateResponse(adaptationPrompt, 'gemini');
      const adaptation = parseAIJSONResponse(response);
      
      if (adaptation.adaptation_needed) {
        // Apply adaptations to the sequence
        const updatedSequence = this.applySequenceAdaptations(currentSequence, adaptation);
        this.userSequences.set(userId, updatedSequence);
        return updatedSequence;
      }
      
      return currentSequence;
    } catch (error) {
      console.error('Error adapting sequence in real-time:', error);
      return currentSequence;
    }
  }

  /**
   * Apply specific adaptations to a sequence
   */
  applySequenceAdaptations(sequence, adaptation) {
    const updatedSequence = { ...sequence };
    
    // Update current position or next concept
    if (adaptation.specific_changes?.next_concept !== 'same') {
      // Find and update the next concept in sequence
      const currentIndex = updatedSequence.learning_sequence.findIndex(
        concept => concept.concept_id === adaptation.specific_changes.next_concept
      );
      if (currentIndex !== -1) {
        updatedSequence.current_position = currentIndex;
      }
    }
    
    // Apply difficulty adjustments
    if (adaptation.specific_changes?.difficulty_adjustment !== 'maintain') {
      updatedSequence.learning_sequence.forEach(concept => {
        if (adaptation.specific_changes.difficulty_adjustment === 'increase') {
          concept.content_customization.difficulty_level = this.increaseDifficulty(concept.content_customization.difficulty_level);
        } else if (adaptation.specific_changes.difficulty_adjustment === 'decrease') {
          concept.content_customization.difficulty_level = this.decreaseDifficulty(concept.content_customization.difficulty_level);
        }
      });
    }
    
    // Apply pacing changes
    if (adaptation.specific_changes?.pacing_change !== 'maintain') {
      updatedSequence.learning_sequence.forEach(concept => {
        concept.content_customization.pacing_adjustment = adaptation.specific_changes.pacing_change.replace('_', '');
      });
    }
    
    // Add adaptation log
    if (!updatedSequence.adaptation_history) {
      updatedSequence.adaptation_history = [];
    }
    updatedSequence.adaptation_history.push({
      timestamp: new Date().toISOString(),
      adaptation_type: adaptation.adaptation_type,
      changes: adaptation.specific_changes,
      reasoning: adaptation.reasoning
    });
    
    return updatedSequence;
  }

  /**
   * Get next concept in the sequence for a user
   */
  getNextConcept(userId, currentProgress) {
    const sequence = this.userSequences.get(userId);
    if (!sequence) return null;
    
    const currentIndex = sequence.current_position || 0;
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < sequence.learning_sequence.length) {
      return sequence.learning_sequence[nextIndex];
    }
    
    return null; // Sequence complete
  }

  /**
   * Cache user sequence
   */
  cacheUserSequence(userId, sequence) {
    this.userSequences.set(userId, {
      ...sequence,
      cached_at: Date.now(),
      current_position: 0
    });
  }

  /**
   * Helper methods for difficulty adjustment
   */
  increaseDifficulty(currentLevel) {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  }

  decreaseDifficulty(currentLevel) {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.max(currentIndex - 1, 0)];
  }

  /**
   * Fallback methods
   */
  generateFallbackPacingAnalysis() {
    return {
      pace_analysis: {
        overall_learning_velocity: 'steady',
        concept_absorption_rate: 'moderate',
        retention_strength: 'stable'
      },
      optimal_pacing: {
        content_delivery_speed: 'moderate',
        concept_introduction_frequency: 'small_groups',
        practice_distribution: 'spaced'
      },
      sequencing_preferences: {
        prefers_linear_progression: true,
        benefits_from_spiraling: false
      }
    };
  }

  generateFallbackDependencyMap(domain) {
    return {
      domain,
      concept_hierarchy: {
        foundational_concepts: [],
        intermediate_concepts: [],
        advanced_concepts: []
      },
      learning_pathways: [],
      prerequisite_matrix: {}
    };
  }

  generateFallbackSequence(userId, request) {
    return {
      sequence_metadata: {
        sequence_id: `fallback_${userId}_${Date.now()}`,
        user_id: userId,
        domain: request.domain || 'space_science',
        personalization_confidence: 0.3
      },
      learning_sequence: [{
        sequence_position: 1,
        concept_id: 'basic_introduction',
        concept_name: 'Introduction to Space Science',
        learning_objectives: ['Understand basic concepts'],
        content_customization: {
          difficulty_level: 'beginner',
          presentation_style: 'multimodal',
          pacing_adjustment: 'normal'
        }
      }],
      branching_strategies: {
        remediation_paths: ['review_basics'],
        enrichment_paths: ['explore_deeper']
      }
    };
  }
}

// Create singleton instance
const intelligentCurriculumSequencer = new IntelligentCurriculumSequencer();

module.exports = { intelligentCurriculumSequencer };