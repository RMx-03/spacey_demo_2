const { aiProviderManager } = require('./aiProviders');
const { enhancedPersonalizationEngine } = require('./enhancedPersonalizationEngine');
const { persistentMemory } = require('./persistentMemory');

/**
 * Helper function to clean and parse JSON responses from AI
 */
function parseAIJSONResponse(response) {
  try {
    return JSON.parse(response);
  } catch (error) {
    console.log('Direct JSON parse failed, trying extraction methods...');
    
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        const cleanedJson = fixCommonJSONIssues(jsonMatch[1].trim());
        return JSON.parse(cleanedJson);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON:', innerError);
      }
    }
    
    // Try to find JSON object in the response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const cleanedJson = fixCommonJSONIssues(objectMatch[0]);
        return JSON.parse(cleanedJson);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON object:', innerError);
      }
    }
    
    // Try to find JSON array in the response
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const cleanedJson = fixCommonJSONIssues(arrayMatch[0]);
        return JSON.parse(cleanedJson);
      } catch (innerError) {
        console.error('Failed to parse extracted JSON array:', innerError);
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
  
  // Fix unquoted property names (but be careful with nested content)
  jsonStr = jsonStr.replace(/(\n\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Fix single quotes to double quotes (but be careful with apostrophes in content)
  jsonStr = jsonStr.replace(/:\s*'([^']*?)'/g, ': "$1"');
  
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
 * Advanced Tutoring Strategy System
 * Implements sophisticated tutoring methodologies including Socratic learning,
 * pedagogy-oriented approaches, curriculum sequencing, and adaptive questioning
 */
class AdvancedTutoringStrategy {
  constructor() {
    this.sessionStrategies = new Map(); // userId -> current session strategy
    this.tutorialProgressTracking = new Map(); // userId -> progress through concepts
    this.socraticDialogueState = new Map(); // userId -> current Socratic sequence
  }

  /**
   * Main entry point for advanced tutoring decisions
   * @param {string} userId - User identifier
   * @param {Object} context - Rich context including lesson, user state, etc.
   * @returns {Promise<Object>} Comprehensive tutoring strategy and actions
   */
  async generateTutoringStrategy(userId, context) {
    console.log(`🎓 Generating advanced tutoring strategy for user ${userId}`);

    try {
      // 1. Get comprehensive user insights (with fallback)
      let personalizationInsights;
      try {
        personalizationInsights = await enhancedPersonalizationEngine.generatePersonalizationInsights(userId, context);
      } catch (error) {
        console.log('Using fallback personalization insights:', error.message);
        personalizationInsights = this.getFallbackPersonalizationInsights();
      }
      
      // 2. Analyze current learning context (with fallback)
      let contextAnalysis;
      try {
        contextAnalysis = await this.analyzeCurrentContext(userId, context, personalizationInsights);
      } catch (error) {
        console.log('Using fallback context analysis:', error.message);
        contextAnalysis = this.getFallbackContextAnalysis();
      }
      
      // 3. Determine appropriate tutoring methodology (with fallback)
      let tutoringMethodology;
      try {
        tutoringMethodology = await this.selectTutoringMethodology(contextAnalysis, personalizationInsights);
      } catch (error) {
        console.log('Using fallback tutoring methodology:', error.message);
        tutoringMethodology = this.getFallbackTutoringMethodology();
      }
      
      // 4. Generate specific tutoring actions (with fallback)
      let tutoringActions;
      try {
        tutoringActions = await this.generateTutoringActions(userId, tutoringMethodology, contextAnalysis);
      } catch (error) {
        console.log('Using fallback tutoring actions:', error.message);
        tutoringActions = this.getFallbackTutoringActions();
      }
      
      // 5. Create adaptive questioning sequence (with fallback)
      let questioningStrategy;
      try {
        questioningStrategy = await this.createQuestioningStrategy(userId, tutoringMethodology, contextAnalysis);
      } catch (error) {
        console.log('Using fallback questioning strategy:', error.message);
        questioningStrategy = this.getFallbackQuestioningStrategy();
      }
      
      // 6. Apply curriculum sequencing logic (with fallback)
      let sequencingStrategy;
      try {
        sequencingStrategy = await this.applySequencingLogic(userId, contextAnalysis, personalizationInsights);
      } catch (error) {
        console.log('Using fallback sequencing strategy:', error.message);
        sequencingStrategy = this.getFallbackSequencingStrategy();
      }
      
      // 7. Compile comprehensive strategy
      const strategy = {
        userId,
        timestamp: new Date().toISOString(),
        methodology: tutoringMethodology,
        actions: tutoringActions,
        questioning: questioningStrategy,
        sequencing: sequencingStrategy,
        personalization: personalizationInsights,
        context: contextAnalysis,
        confidence: this.calculateStrategyConfidence(contextAnalysis, personalizationInsights)
      };

      // Update session tracking
      this.updateSessionStrategy(userId, strategy);
      
      return strategy;

    } catch (error) {
      console.error('❌ Error generating tutoring strategy:', error);
      return this.generateFallbackStrategy(userId, context);
    }
  }

  /**
   * Analyze the current learning context comprehensively
   */
  async analyzeCurrentContext(userId, context, personalizationInsights) {
    const analysisPrompt = `Analyze the current tutoring context and determine the optimal teaching approach.

PERSONALIZATION INSIGHTS:
Learning Style: ${personalizationInsights.learningAnalysis?.learningStyle?.primary || 'unknown'}
Cognitive Profile: ${JSON.stringify(personalizationInsights.cognitiveProfile?.cognitive_strengths || {})}
Knowledge Gaps: ${personalizationInsights.knowledgeMapping?.critical_gaps?.join(', ') || 'none identified'}
Current Capacity: ${personalizationInsights.cognitiveProfile?.learning_progression?.current_capacity || 'unknown'}

LESSON CONTEXT:
${context.lessonData ? `Current Lesson: ${context.lessonData.title}` : 'No lesson context'}
${context.currentBlock ? `Current Block: ${context.currentBlock.block_id} (${context.currentBlock.type})` : 'No block context'}
${context.userResponse ? `Recent Response: ${JSON.stringify(context.userResponse)}` : 'No recent response'}

USER STATE:
${context.emotionalState ? `Emotional State: ${JSON.stringify(context.emotionalState)}` : 'No emotional context'}
${context.userMood ? `Current Mood: ${context.userMood}` : 'No mood context'}
${context.timeSinceLastInteraction ? `Time Since Last Interaction: ${context.timeSinceLastInteraction}ms` : 'No timing context'}

Provide detailed context analysis:
{
  "learning_situation": {
    "current_task": "what the user is trying to learn/do",
    "difficulty_level": "too_easy|appropriate|too_hard|unknown",
    "engagement_level": "low|medium|high|unknown",
    "comprehension_signals": ["understanding_indicators"],
    "struggle_indicators": ["signs_of_difficulty"],
    "readiness_for_next": "ready|needs_consolidation|needs_remediation"
  },
  "cognitive_state": {
    "cognitive_load": "low|medium|high|overloaded",
    "attention_focus": "focused|distracted|variable",
    "motivation_level": "low|medium|high",
    "confidence_level": "low|medium|high",
    "energy_level": "tired|normal|energetic"
  },
  "teaching_opportunities": {
    "misconceptions_to_address": ["misconception1", "misconception2"],
    "connections_to_make": ["connection1", "connection2"],
    "skills_to_practice": ["skill1", "skill2"],
    "concepts_to_deepen": ["concept1", "concept2"],
    "applications_to_explore": ["application1", "application2"]
  },
  "intervention_needs": {
    "immediate_support": "what kind of help is needed now",
    "encouragement_type": "confidence|persistence|celebration|redirection",
    "scaffolding_level": "minimal|moderate|heavy",
    "feedback_urgency": "immediate|soon|can_wait",
    "break_recommendation": "continue|short_break|longer_break"
  },
  "optimal_next_steps": ["step1", "step2", "step3"]
}`;

    try {
      const response = await aiProviderManager.generateResponse(analysisPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error analyzing context:', error);
      return this.generateFallbackContextAnalysis(context);
    }
  }

  /**
   * Select the most appropriate tutoring methodology
   */
  async selectTutoringMethodology(contextAnalysis, personalizationInsights) {
    const methodologyPrompt = `Select the optimal tutoring methodology based on the learner and context.

CONTEXT ANALYSIS:
${JSON.stringify(contextAnalysis, null, 2)}

LEARNER PROFILE:
Cognitive Preferences: ${JSON.stringify(personalizationInsights.learningAnalysis?.cognitivePreferences || {})}
Motivational Factors: ${JSON.stringify(personalizationInsights.learningAnalysis?.motivationalFactors || {})}
Adaptation Strategies: ${JSON.stringify(personalizationInsights.adaptiveStrategies?.content_adaptation || {})}

Select and customize the best tutoring approach:
{
  "primary_methodology": {
    "approach": "socratic|guided_discovery|direct_instruction|problem_based|inquiry_based|scaffolded|constructivist",
    "reasoning": "why this approach is optimal",
    "confidence": 0.8,
    "customizations": ["specific adaptations for this learner"]
  },
  "secondary_approaches": [
    {
      "approach": "backup methodology",
      "when_to_use": "specific conditions",
      "integration_strategy": "how to blend with primary"
    }
  ],
  "pedagogy_principles": {
    "constructivist_elements": ["building on prior knowledge", "active construction"],
    "social_learning": ["collaboration", "modeling", "discussion"],
    "cognitive_science": ["spacing", "interleaving", "testing"],
    "motivation_theory": ["autonomy", "mastery", "purpose", "relatedness"]
  },
  "socratic_strategy": {
    "questioning_depth": "surface|intermediate|deep",
    "scaffold_removal": "gradual|immediate|adaptive",
    "discovery_guidance": "minimal|moderate|substantial",
    "cognitive_conflict": "low|medium|high"
  },
  "adaptive_elements": {
    "difficulty_adjustment": "real-time rules",
    "pacing_control": "learner-driven|system-driven|collaborative",
    "content_branching": "how to adapt based on responses",
    "assessment_integration": "formative|summative|embedded"
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(methodologyPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error selecting methodology:', error);
      return this.generateFallbackMethodology();
    }
  }

  /**
   * Generate specific tutoring actions based on methodology
   */
  async generateTutoringActions(userId, methodology, contextAnalysis) {
    const currentStrategy = this.sessionStrategies.get(userId) || {};
    
    const actionsPrompt = `Generate specific tutoring actions based on the selected methodology and context.

METHODOLOGY:
${JSON.stringify(methodology, null, 2)}

CONTEXT:
${JSON.stringify(contextAnalysis, null, 2)}

CURRENT SESSION STRATEGY:
${JSON.stringify(currentStrategy, null, 2)}

Generate immediate and strategic tutoring actions:
{
  "immediate_actions": {
    "primary_action": {
      "type": "question|explanation|encouragement|scaffolding|redirection|assessment",
      "content": "specific content to deliver",
      "rationale": "why this action now",
      "expected_outcome": "what this should achieve"
    },
    "secondary_actions": [
      {
        "type": "action_type",
        "content": "backup action",
        "trigger": "when to use this instead"
      }
    ],
    "response_adaptations": {
      "if_successful": "next action if this works",
      "if_struggling": "what to do if learner struggles",
      "if_confused": "clarification strategy",
      "if_bored": "engagement escalation"
    }
  },
  "strategic_actions": {
    "concept_development": {
      "current_focus": "main concept to develop",
      "progression_steps": ["step1", "step2", "step3"],
      "mastery_indicators": ["signs of understanding"],
      "remediation_plan": "if mastery not achieved"
    },
    "skill_building": {
      "target_skills": ["skill1", "skill2"],
      "practice_opportunities": ["practice1", "practice2"],
      "feedback_points": ["when to give feedback"],
      "transfer_activities": ["how to apply skills"]
    },
    "metacognitive_development": {
      "self_awareness_prompts": ["prompt1", "prompt2"],
      "strategy_discussions": ["strategy1", "strategy2"],
      "reflection_triggers": ["when to reflect"],
      "goal_setting": "how to help set learning goals"
    }
  },
  "session_management": {
    "pacing_adjustments": "how to manage lesson pacing",
    "break_timing": "when breaks are optimal",
    "energy_monitoring": "signs to watch for",
    "closure_strategy": "how to end the session well"
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(actionsPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error generating tutoring actions:', error);
      return this.generateFallbackActions();
    }
  }

  /**
   * Create sophisticated questioning strategy (Socratic method implementation)
   */
  async createQuestioningStrategy(userId, methodology, contextAnalysis) {
    const currentDialogue = this.socraticDialogueState.get(userId) || { sequence: [], depth: 0 };
    
    const questioningPrompt = `Create a sophisticated questioning strategy using Socratic principles.

METHODOLOGY:
Socratic Strategy: ${JSON.stringify(methodology.socratic_strategy || {})}
Primary Approach: ${methodology.primary_methodology?.approach}

CONTEXT:
Learning Situation: ${JSON.stringify(contextAnalysis.learning_situation || {})}
Teaching Opportunities: ${JSON.stringify(contextAnalysis.teaching_opportunities || {})}

CURRENT DIALOGUE STATE:
Previous Questions: ${currentDialogue.sequence.slice(-3).map(q => q.question).join('; ') || 'None'}
Current Depth: ${currentDialogue.depth}

Generate a multi-level questioning strategy:
{
  "questioning_sequence": {
    "opening_questions": {
      "knowledge_probe": "what do you already know about...",
      "experience_connection": "have you ever experienced...",
      "curiosity_starter": "what do you wonder about...",
      "prediction_prompt": "what do you think will happen if..."
    },
    "development_questions": {
      "clarification": ["help me understand what you mean by...", "can you give me an example of..."],
      "assumption_challenge": ["what assumptions are you making?", "how do you know that's true?"],
      "evidence_examination": ["what evidence supports that?", "what might contradict that?"],
      "perspective_taking": ["how might someone else see this?", "what are the implications?"]
    },
    "deepening_questions": {
      "causal_reasoning": ["why do you think that happens?", "what causes that effect?"],
      "system_thinking": ["how does this connect to...?", "what are the broader implications?"],
      "metacognitive": ["how did you figure that out?", "what was your thinking process?"],
      "application": ["how could you use this in...?", "where else might this apply?"]
    }
  },
  "questioning_tactics": {
    "wait_time": "3-5 seconds for thinking",
    "follow_up_probes": ["can you say more about that?", "what makes you think that?"],
    "thinking_visible": ["what's going through your mind?", "talk me through your reasoning"],
    "error_exploration": ["that's interesting, what led you there?", "let's examine that thinking"]
  },
  "adaptive_questioning": {
    "if_correct_answer": "how can we extend this thinking?",
    "if_partial_answer": "what might you add to that?",
    "if_incorrect_answer": "what part of that seems right to you?",
    "if_no_answer": "what's a small step we could take?",
    "if_confused": "let's back up - what do you feel confident about?"
  },
  "socratic_principles": {
    "intellectual_humility": "model not-knowing and curiosity",
    "critical_thinking": "question assumptions and examine evidence",
    "collaborative_inquiry": "explore together rather than tell",
    "self_discovery": "guide learner to their own insights"
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(questioningPrompt, 'gemini');
      const strategy = parseAIJSONResponse(response);
      
      // Update dialogue state
      this.updateSocraticDialogue(userId, strategy);
      
      return strategy;
    } catch (error) {
      console.error('Error creating questioning strategy:', error);
      return this.generateFallbackQuestioningStrategy();
    }
  }

  /**
   * Apply intelligent curriculum sequencing
   */
  async applySequencingLogic(userId, contextAnalysis, personalizationInsights) {
    const sequencingPrompt = `Design intelligent curriculum sequencing based on learning science principles.

LEARNER STATE:
Knowledge Mapping: ${JSON.stringify(personalizationInsights.knowledgeMapping || {})}
Learning Readiness: ${JSON.stringify(personalizationInsights.knowledgeMapping?.learning_readiness || {})}
Cognitive Profile: ${JSON.stringify(personalizationInsights.cognitiveProfile?.learning_progression || {})}

CURRENT CONTEXT:
Learning Situation: ${JSON.stringify(contextAnalysis.learning_situation || {})}
Next Steps: ${contextAnalysis.optimal_next_steps?.join(', ') || 'none identified'}

Apply sequencing principles:
{
  "prerequisite_analysis": {
    "current_foundations": ["concepts learner has mastered"],
    "missing_prerequisites": ["gaps that need addressing"],
    "prerequisite_priority": ["which gaps to address first"],
    "foundation_strength": "solid|moderate|weak"
  },
  "sequencing_strategy": {
    "progression_path": ["concept1", "concept2", "concept3"],
    "difficulty_gradient": "gentle|moderate|steep",
    "branching_points": ["where to offer choices"],
    "optional_extensions": ["enrichment opportunities"],
    "review_integration": ["when and how to review"]
  },
  "cognitive_load_management": {
    "information_chunking": "how to break down complex ideas",
    "scaffolding_sequence": "how to gradually remove support",
    "practice_distribution": "spacing and interleaving plan",
    "cognitive_rest_points": "when to consolidate learning"
  },
  "personalization_factors": {
    "interest_integration": "how to weave in personal interests",
    "strength_leveraging": "using learner strengths as bridges",
    "weakness_support": "targeted help for struggling areas",
    "pace_adaptation": "how to adjust timing and speed"
  },
  "assessment_integration": {
    "formative_checkpoints": ["when to check understanding"],
    "mastery_criteria": ["what demonstrates competence"],
    "remediation_triggers": ["when to provide extra help"],
    "advancement_indicators": ["when ready for next level"]
  },
  "engagement_maintenance": {
    "variety_injection": "when and how to change activities",
    "challenge_calibration": "keeping optimal difficulty",
    "motivation_sustainers": ["elements that maintain interest"],
    "autonomy_opportunities": ["where to give learner control"]
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(sequencingPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error applying sequencing logic:', error);
      return this.generateFallbackSequencing();
    }
  }

  /**
   * Update session strategy tracking
   */
  updateSessionStrategy(userId, strategy) {
    this.sessionStrategies.set(userId, {
      ...strategy,
      session_start: this.sessionStrategies.get(userId)?.session_start || Date.now(),
      strategy_count: (this.sessionStrategies.get(userId)?.strategy_count || 0) + 1,
      last_update: Date.now()
    });
  }

  /**
   * Update Socratic dialogue state
   */
  updateSocraticDialogue(userId, questioningStrategy) {
    const current = this.socraticDialogueState.get(userId) || { sequence: [], depth: 0 };
    
    this.socraticDialogueState.set(userId, {
      sequence: [
        ...current.sequence,
        {
          timestamp: Date.now(),
          strategy: questioningStrategy,
          question: questioningStrategy.questioning_sequence?.opening_questions?.knowledge_probe || 'What do you think about this?'
        }
      ].slice(-10), // Keep last 10 questions
      depth: current.depth + 1,
      last_update: Date.now()
    });
  }

  /**
   * Calculate confidence in the strategy recommendations
   */
  calculateStrategyConfidence(contextAnalysis, personalizationInsights) {
    let confidence = 0;
    
    // Context clarity
    if (contextAnalysis.learning_situation?.current_task) confidence += 0.2;
    if (contextAnalysis.cognitive_state?.cognitive_load !== 'unknown') confidence += 0.2;
    
    // Personalization depth
    if (personalizationInsights.confidence > 0.7) confidence += 0.3;
    else if (personalizationInsights.confidence > 0.4) confidence += 0.2;
    
    // Knowledge mapping quality
    if (personalizationInsights.knowledgeMapping?.critical_gaps?.length > 0) confidence += 0.15;
    if (personalizationInsights.knowledgeMapping?.foundation_strengths?.length > 0) confidence += 0.15;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Fallback methods for error conditions
   */
  generateFallbackStrategy(userId, context) {
    return {
      userId,
      timestamp: new Date().toISOString(),
      methodology: this.generateFallbackMethodology(),
      actions: this.generateFallbackActions(),
      questioning: this.generateFallbackQuestioningStrategy(),
      sequencing: this.generateFallbackSequencing(),
      confidence: 0.3,
      fallback: true
    };
  }

  generateFallbackContextAnalysis(context) {
    return {
      learning_situation: {
        current_task: 'unknown',
        difficulty_level: 'unknown',
        engagement_level: 'medium',
        readiness_for_next: 'needs_assessment'
      },
      cognitive_state: {
        cognitive_load: 'medium',
        attention_focus: 'variable',
        motivation_level: 'medium'
      },
      teaching_opportunities: {
        skills_to_practice: ['basic_concepts']
      },
      intervention_needs: {
        scaffolding_level: 'moderate',
        encouragement_type: 'confidence'
      }
    };
  }

  generateFallbackMethodology() {
    return {
      primary_methodology: {
        approach: 'guided_discovery',
        reasoning: 'safe default for unknown learner state',
        confidence: 0.5,
        customizations: ['moderate_scaffolding', 'frequent_feedback']
      },
      socratic_strategy: {
        questioning_depth: 'intermediate',
        scaffold_removal: 'gradual',
        discovery_guidance: 'moderate'
      }
    };
  }

  generateFallbackActions() {
    return {
      immediate_actions: {
        primary_action: {
          type: 'question',
          content: 'What would you like to explore about this topic?',
          rationale: 'gather learner interest and current understanding',
          expected_outcome: 'engagement and assessment'
        }
      },
      strategic_actions: {
        concept_development: {
          current_focus: 'foundational_understanding',
          progression_steps: ['assess', 'explain', 'practice']
        }
      }
    };
  }

  generateFallbackQuestioningStrategy() {
    return {
      questioning_sequence: {
        opening_questions: {
          knowledge_probe: 'What do you already know about this topic?',
          curiosity_starter: 'What interests you most about this?'
        },
        development_questions: {
          clarification: ['Can you tell me more about that?'],
          evidence_examination: ['What makes you think that?']
        }
      },
      questioning_tactics: {
        wait_time: '3-5 seconds',
        follow_up_probes: ['Can you explain that further?']
      }
    };
  }

  generateFallbackSequencing() {
    return {
      prerequisite_analysis: {
        foundation_strength: 'moderate'
      },
      sequencing_strategy: {
        progression_path: ['assess_current_knowledge', 'build_foundation', 'practice_application'],
        difficulty_gradient: 'gentle'
      },
      cognitive_load_management: {
        information_chunking: 'break into small steps',
        scaffolding_sequence: 'provide heavy support initially'
      }
    };
  }

  // === FALLBACK METHODS ===

  getFallbackPersonalizationInsights() {
    return {
      learningAnalysis: {
        learningStyle: { primary: 'multimodal', confidence: 0.5 },
        cognitivePreferences: { processingSpeed: 'medium' }
      },
      knowledgeMapping: {
        critical_gaps: [],
        foundation_strengths: []
      },
      cognitiveProfile: {
        optimal_conditions: { cognitive_load: 'moderate' }
      }
    };
  }

  getFallbackContextAnalysis() {
    return {
      current_state: 'exploring',
      engagement_level: 'moderate',
      cognitive_load: 'manageable',
      emotional_state: 'neutral',
      learning_readiness: 'ready'
    };
  }

  getFallbackTutoringMethodology() {
    return {
      primary_methodology: {
        approach: 'guided_discovery',
        scaffolding_level: 'moderate',
        interaction_style: 'supportive'
      },
      adaptive_elements: ['encouragement', 'examples']
    };
  }

  getFallbackTutoringActions() {
    return {
      strategic_actions: {
        concept_development: {
          progression_steps: ['introduce', 'practice', 'apply']
        }
      },
      immediate_actions: ['provide_encouragement']
    };
  }

  getFallbackQuestioningStrategy() {
    return {
      approach: 'guided_inquiry',
      opening_questions: ['What interests you about this topic?'],
      follow_up_probes: ['Can you tell me more?'],
      questioning_tactics: {
        wait_time: '3-5 seconds',
        encouragement_frequency: 'high'
      }
    };
  }

  getFallbackSequencingStrategy() {
    return {
      optimal_next_steps: ['continue_current_topic'],
      difficulty_adjustment: 'maintain',
      pacing_recommendation: 'steady'
    };
  }
}

// Create singleton instance
const advancedTutoringStrategy = new AdvancedTutoringStrategy();

module.exports = { advancedTutoringStrategy };
