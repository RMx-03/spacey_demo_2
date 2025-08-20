const { aiProviderManager } = require('./aiProviders');
const { persistentMemory } = require('./persistentMemory');
const { parseAIJSONResponse, fixCommonJSONIssues } = require('../utils/jsonParser');
const fs = require('fs').promises;
const path = require('path');
const prompts = require('../prompts');

// Remove local helpers; using shared utils/jsonParser

/**
 * Dynamic Lesson Generator - Creates personalized lessons in real-time
 * Based on user profile, learning goals, and current progress
 */
class DynamicLessonGenerator {
  constructor() {
    this.templateDir = path.join(__dirname, '../../client/public/lessons');
    this.generatedLessonsCache = new Map(); // userId -> generated lessons cache
    this.maxCacheSize = 100;
  }

  /**
   * NEW: Generate content for a single plan step (Content Generator role)
   * @param {Object} step - Plan step { id, type, title, objective, estimated_minutes, options? }
   * @param {Object} options - Context options
   * @param {string} options.topic - Overall lesson topic
   * @param {Object} options.userProfile - Full user profile
   * @param {Object} [options.learningAnalysis] - Optional learning analysis
   * @param {Array} [options.previousBlocks] - Previously generated blocks for context
   * @returns {Promise<Object>} Generated slide/block JSON
   */
  async generateContentForStep(step, { topic, userProfile, learningAnalysis = null, enhancedContext = null, previousBlocks = [], conversationSummary = '' } = {}) {
    const type = String(step.type || 'narration').toLowerCase();
    try {
      if (type === 'choice') {
        // Choice blocks are lightweight and primarily structural
        const choices = Array.isArray(step.options) && step.options.length > 0
          ? step.options.map(opt => ({
              text: opt.text || 'Choose',
              next_block: opt.next || null,
              consequence: opt.consequence || null,
              learning_value: opt.learning_value || null,
              difficulty_level: learningAnalysis?.currentLevel || 'adaptive'
            }))
          : [
              { text: 'Explore Path A', next_block: null, consequence: 'Different examples', learning_value: 'Application focus', difficulty_level: 'adaptive' },
              { text: 'Explore Path B', next_block: null, consequence: 'Different examples', learning_value: 'Concept focus', difficulty_level: 'adaptive' }
            ];
        return {
          block_id: step.id,
          type: 'choice',
          title: step.title,
          content: 'Choose your next course of action to continue the mission.',
          learning_goal: step.objective,
          choices,
          llm_instruction: 'Present options neutrally. After user selects, branch to indicated next block.',
        };
      }

      if (type === 'image') {
        // Simple non-LLM image block
        return {
          block_id: step.id,
          type: 'image',
          title: step.title,
          content: step.objective,
          learning_goal: step.objective,
          media: { image: '/images/space_scene.png' },
          llm_instruction: 'Use the image to anchor the brief explanation. Invite observation.',
        };
      }

      // Use specialized prompts for narration, quiz, reflection
      let prompt;
      if (type === 'quiz') {
        prompt = prompts.generateQuizPrompt({ topic, step, userProfile });
      } else if (type === 'reflection') {
        prompt = prompts.generateReflectionPrompt({ topic, step, userProfile });
      } else {
        prompt = prompts.generateNarrationPrompt({ topic, step, userProfile });
      }

      // Append active context to steer generation without changing expected JSON keys
      const contextLines = [];
      try {
        if (learningAnalysis) contextLines.push(`learning_analysis=${JSON.stringify(learningAnalysis)}`);
        if (enhancedContext) {
          const slim = {
            preferredTopics: enhancedContext.preferredTopics || [],
            strugglingTopics: enhancedContext.strugglingTopics || [],
            masteredConcepts: enhancedContext.masteredConcepts || [],
            totalInteractions: enhancedContext.totalInteractions || 0,
          };
          contextLines.push(`enhanced_context=${JSON.stringify(slim)}`);
        }
        if (previousBlocks && previousBlocks.length > 0) {
          const last = previousBlocks[previousBlocks.length - 1];
          contextLines.push(`previous_block_summary=${JSON.stringify({ id: last.block_id, type: last.type, goal: last.learning_goal })}`);
        }
        if (conversationSummary) contextLines.push(`conversation_summary=${conversationSummary}`);
      } catch (_) {}
      if (contextLines.length) {
        prompt += `\n\nACTIVE USER CONTEXT (for better personalization, do not echo):\n${contextLines.join('\n')}`;
      }

      const response = await aiProviderManager.generateResponse(prompt, 'gemini');
      try {
        const parsed = parseAIJSONResponse(response);
        return parsed;
      } catch (e) {
        const cleaned = fixCommonJSONIssues(String(response));
        return JSON.parse(cleaned);
      }
    } catch (error) {
      console.error('Content generation error for step', step?.id, error.message);
      // Fallback minimal block
      return {
        block_id: step.id,
        type,
        title: step.title,
        content: `This slide covers: ${step.objective}`,
        learning_goal: step.objective,
        media: { image: '/images/mars_base_dark.png' },
        llm_instruction: 'Provide supportive, encouraging guidance.',
        error: 'Fallback content due to AI error',
      };
    }
  }

  /**
   * Generate a dynamic lesson tailored to the user's profile and learning needs
   * @param {string} userId - User identifier
   * @param {Object} lessonRequest - Lesson generation parameters
   * @returns {Promise<Object>} Generated lesson with blocks
   */
  async generateDynamicLesson(userId, lessonRequest) {
    const {
      baseTopicOrLesson,
      learningObjectives = [],
      difficultyLevel = 'adaptive',
      estimatedDuration = 20,
      focusAreas = [],
      weaknessesToAddress = [],
      strengthsToLeverage = []
    } = lessonRequest;

    console.log(`🎯 Generating dynamic lesson for user ${userId}: ${baseTopicOrLesson}`);

    try {
      // 1. Get comprehensive user profile
      const userProfile = await persistentMemory.getUserProfile(userId);
      
      // 2. Analyze user's current learning state
      const learningAnalysis = await this.analyzeLearningState(userId, userProfile);
      
      // 3. Get base lesson template (if adapting existing lesson)
      let baseLessonTemplate = null;
      if (baseTopicOrLesson && !baseTopicOrLesson.includes('custom_')) {
        baseLessonTemplate = await this.loadLessonTemplate(baseTopicOrLesson);
      }

      // 4. Generate lesson structure
      const lessonStructure = await this.generateLessonStructure({
        userId,
        userProfile,
        learningAnalysis,
        baseLessonTemplate,
        learningObjectives,
        difficultyLevel,
        estimatedDuration,
        focusAreas,
        weaknessesToAddress,
        strengthsToLeverage
      });

      // 5. Generate detailed lesson blocks
      const generatedLesson = await this.generateLessonBlocks(lessonStructure, userProfile, learningAnalysis);

      // 6. Apply advanced tutoring strategies
      const enhancedLesson = await this.applyTutoringStrategies(generatedLesson, userProfile, learningAnalysis);

      // 7. Cache the generated lesson
      this.cacheGeneratedLesson(userId, enhancedLesson);

      console.log(`✅ Generated dynamic lesson with ${enhancedLesson.blocks.length} blocks`);
      return enhancedLesson;

    } catch (error) {
      console.error('❌ Error generating dynamic lesson:', error);
      throw new Error('Failed to generate dynamic lesson: ' + error.message);
    }
  }

  /**
   * Analyze user's current learning state and preferences
   */
  async analyzeLearningState(userId, userProfile) {
    const analysisPrompt = `CRITICAL: Return ONLY valid JSON. No markdown, no extra text, no comments.\n\nAnalyze this learner's profile and provide learning state insights.

User Profile:
${JSON.stringify({
  learning: userProfile.learning,
  emotional: userProfile.emotional,
  communication: userProfile.communication,
  topics: userProfile.topics,
  stats: userProfile.stats
}, null, 2)}

Provide a JSON response with:
{
  "currentLevel": "beginner|intermediate|advanced",
  "learningStyle": "visual|auditory|kinesthetic|reading|multimodal",
  "cognitiveLoad": "low|medium|high",
  "motivationLevel": "low|medium|high",
  "attentionSpan": "short|medium|long",
  "preferredPacing": "slow|medium|fast",
  "strugglingAreas": ["topic1", "topic2"],
  "strongAreas": ["topic1", "topic2"],
  "recommendedApproach": "scaffolded|inquiry-based|direct-instruction|problem-based",
  "personalityFactors": {
    "needsEncouragement": boolean,
    "enjoysChallenge": boolean,
    "prefersStructure": boolean,
    "respondsToNarratives": boolean
  }
}`;

    try {
      const response = await aiProviderManager.generateResponse(analysisPrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error analyzing learning state:', error);
      // Return default analysis
      return {
        currentLevel: userProfile.learning?.comprehensionLevel || 'beginner',
        learningStyle: userProfile.learning?.preferredStyle || 'multimodal',
        cognitiveLoad: 'medium',
        motivationLevel: 'medium',
        attentionSpan: 'medium',
        preferredPacing: 'medium',
        strugglingAreas: userProfile.learning?.strugglingTopics || [],
        strongAreas: userProfile.learning?.preferredTopics || [],
        recommendedApproach: 'inquiry-based',
        personalityFactors: {
          needsEncouragement: true,
          enjoysChallenge: true,
          prefersStructure: true,
          respondsToNarratives: true
        }
      };
    }
  }

  /**
   * Load existing lesson template as base
   */
  async loadLessonTemplate(lessonId) {
    try {
      const lessonPath = path.join(this.templateDir, `${lessonId}.json`);
      const lessonData = await fs.readFile(lessonPath, 'utf8');
      return JSON.parse(lessonData);
    } catch (error) {
      console.log(`No template found for ${lessonId}, will generate from scratch`);
      return null;
    }
  }

  /**
   * Generate the overall lesson structure and flow
   */
  async generateLessonStructure(params) {
    const {
      userId,
      userProfile,
      learningAnalysis,
      baseLessonTemplate,
      learningObjectives,
      difficultyLevel,
      estimatedDuration,
      focusAreas,
      weaknessesToAddress,
      strengthsToLeverage
    } = params;

  const baseTemplateSection = baseLessonTemplate ? `\nBASE LESSON TEMPLATE (for analysis and alignment):\n${JSON.stringify(baseLessonTemplate, null, 2)}\n\nADAPTATION INSTRUCTIONS:\n- Respect core flow and key objectives of the base template.\n- Modernize tutoring strategies (Socratic, scaffolding, checkpoints).\n- Keep or refine engaging beats (briefing, exploration, decision, reflection).` : '';

  const structurePrompt = `CRITICAL: You must return ONLY valid JSON. No markdown, no extra text, no comments.\n\nGenerate a personalized lesson structure for this space science lesson.\n${baseTemplateSection}\n\nUSER CONTEXT:\n- Learning Level: ${learningAnalysis.currentLevel}\n- Learning Style: ${learningAnalysis.learningStyle}\n- Preferred Pacing: ${learningAnalysis.preferredPacing}\n- Struggling Areas: ${learningAnalysis.strugglingAreas.join(', ')}\n- Strong Areas: ${learningAnalysis.strongAreas.join(', ')}\n- Recommended Approach: ${learningAnalysis.recommendedApproach}\n\nLESSON REQUIREMENTS:\n- Duration: ${estimatedDuration} minutes\n- Difficulty: ${difficultyLevel}\n- Focus Areas: ${focusAreas.join(', ')}\n- Address Weaknesses: ${weaknessesToAddress.join(', ')}\n- Leverage Strengths: ${strengthsToLeverage.join(', ')}\n- Learning Objectives: ${learningObjectives.join(', ')}\n- Must have at least ${baseLessonTemplate?.total_blocks || 8} blocks to match original lesson depth\n\nReturn ONLY this JSON structure:\n{\n  "mission_id": "dynamic_lesson_${Date.now()}",\n  "title": "Engaging space mission title",\n  "description": "Brief description targeting user's interests",\n  "total_blocks": 8,\n  "estimated_duration": ${estimatedDuration},\n  "difficulty_level": "adaptive",\n  "learning_objectives": ["objective1", "objective2", "objective3"],\n  "personalization_strategy": "brief strategy explanation",\n  "tutoring_approach": "guided",\n  "block_structure": [\n    {\n      "block_id": "intro_1",\n      "type": "narration",\n      "title": "Mission Briefing",\n      "learning_focus": "specific concept",\n      "personalization_notes": "how this addresses user needs",\n      "estimated_minutes": 2,\n      "difficulty_progression": "building",\n      "tutoring_strategy": "direct instruction"\n    },\n    {\n      "block_id": "exploration_2", \n      "type": "choice",\n      "title": "Decision Point",\n      "learning_focus": "concept application",\n      "personalization_notes": "choice structure suits user",\n      "estimated_minutes": 3,\n      "difficulty_progression": "building",\n      "tutoring_strategy": "guided practice"\n    }\n  ]\n}\n\nENSURE: \n- All property names are in quotes\n- All arrays end properly with commas between elements \n- All objects are properly closed\n- No trailing commas\n- Exactly ${estimatedDuration} total minutes across all blocks`;

    try {
      const response = await aiProviderManager.generateResponse(structurePrompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error generating lesson structure:', error);
      // Fallback: generate a simple deterministic structure
      const nowId = `dynamic_lesson_${Date.now()}`;
      const totalBlocks = Math.max(6, Math.min(12, Math.ceil(estimatedDuration / 2)));
      const block_structure = Array.from({ length: totalBlocks }, (_, i) => {
        const idx = i + 1;
        const isChoice = idx % 3 === 0;
        return {
          block_id: `${isChoice ? 'choice' : 'block'}_${idx}`,
          type: isChoice ? 'choice' : 'narration',
          title: isChoice ? `Decision Point ${idx}` : `Learning Block ${idx}`,
          learning_focus: focusAreas[i % Math.max(1, focusAreas.length)] || (learningObjectives[i % Math.max(1, learningObjectives.length)] || 'core concept'),
          personalization_notes: 'Fallback structure tailored from provided parameters',
          estimated_minutes: Math.max(1, Math.round(estimatedDuration / totalBlocks)),
          difficulty_progression: i < totalBlocks / 3 ? 'building' : i < (2 * totalBlocks) / 3 ? 'developing' : 'advancing',
          tutoring_strategy: isChoice ? 'guided practice' : 'direct instruction'
        };
      });

      return {
        mission_id: nowId,
        title: 'Adaptive Space Mission (Fallback)',
        description: 'Auto-generated structure due to AI unavailability. Uses provided objectives and focus areas.',
        total_blocks: totalBlocks,
        estimated_duration: estimatedDuration,
        difficulty_level: difficultyLevel,
        learning_objectives: learningObjectives.length ? learningObjectives : ['Understand key ideas', 'Practice application', 'Reflect and connect'],
        personalization_strategy: 'Parameter-driven tailoring (fallback mode)',
        tutoring_approach: 'guided',
        block_structure
      };
    }
  }

  /**
   * Generate detailed content for each lesson block
   */
  async generateLessonBlocks(lessonStructure, userProfile, learningAnalysis) {
    // Generate blocks with optimized parallel processing
    const blocks = await this.generateBlocksOptimized(
      lessonStructure.block_structure,
      lessonStructure,
      userProfile,
      learningAnalysis
    );

    return {
      ...lessonStructure,
      blocks,
      generated_at: new Date().toISOString(),
      user_id: userProfile.userId,
      personalization_applied: true
    };
  }

  /**
   * Generate a single lesson block with full content
   */
  async generateSingleBlock(blockTemplate, lessonStructure, userProfile, learningAnalysis, blockIndex, previousBlocks) {
    const isFirstBlock = blockIndex === 0;
    const isLastBlock = blockIndex === lessonStructure.block_structure.length - 1;
    const nextBlockId = !isLastBlock ? lessonStructure.block_structure[blockIndex + 1].block_id : null;

    const blockPrompt = `CRITICAL: Return ONLY valid JSON. No markdown, no extra text, no comments.

Generate detailed content for this lesson block.

LESSON CONTEXT:
Title: ${lessonStructure.title}
Mission: ${lessonStructure.mission_id}
Overall Approach: ${lessonStructure.tutoring_approach}

BLOCK TEMPLATE:
${JSON.stringify(blockTemplate, null, 2)}

USER PROFILE:
- Name: ${userProfile.identity?.name || 'Explorer'}
- Learning Style: ${learningAnalysis.learningStyle}
- Cognitive Load: ${learningAnalysis.cognitiveLoad}
- Attention Span: ${learningAnalysis.attentionSpan}
- Needs Encouragement: ${learningAnalysis.personalityFactors.needsEncouragement}
- Responds to Narratives: ${learningAnalysis.personalityFactors.respondsToNarratives}
- Enjoys Challenge: ${learningAnalysis.personalityFactors.enjoysChallenge}

PREVIOUS BLOCKS CONTEXT:
${previousBlocks.length > 0 ? JSON.stringify(previousBlocks.slice(-2), null, 2) : 'None - this is the first block'}

Return ONLY a single JSON object with exactly these properties:
{
  "block_id": "${blockTemplate.block_id}",
  "type": "${blockTemplate.type}",
  "title": "${blockTemplate.title}",
  "content": "Rich, engaging narrative content (3-4 paragraphs) that hooks the learner and sets up the scenario. Use space mission themes and address the learner as their role title.",
  "learning_goal": "Clear, specific learning objective for this block",
  "media": {
    "image": "/images/appropriate_space_image.png",
    "audio": "/audio/appropriate_sound.mp3",
    "3d_model": "/models/appropriate_model.glb"
  },
  "llm_instruction": "Detailed instructions for the AI tutor on how to interact in this block context, including tone, teaching approach, and personalization strategies",
  "next_block": ${nextBlockId ? `"${nextBlockId}"` : 'null'},
  "personalization": {
    "difficulty_adapted": "how difficulty was adjusted for this user",
    "style_adapted": "how content was adapted for learning style",
    "engagement_hooks": ["specific elements to engage this learner"],
    "weakness_support": "how this block helps with identified weaknesses",
    "strength_leverage": "how this block builds on user strengths"
  },
  "tutoring_elements": {
    "socratic_questions": ["question1", "question2"],
    "scaffolding_provided": "what support is built in",
    "inquiry_prompts": ["prompt1", "prompt2"],
    "real_world_connections": ["connection1", "connection2"]
  },
  "adaptive_features": {
    "success_indicators": ["what shows understanding"],
    "struggle_triggers": ["what indicates difficulty"],
    "adjustment_strategies": ["how to adapt if struggling"]
  }
}

If the block type is "choice", you MUST include an additional property "choices" as an array inside the same object, with items shaped as:
{
  "text": "Choice option text",
  "consequence": "What happens if chosen",
  "learning_value": "What this teaches",
  "next_block": "where this leads",
  "difficulty_level": "appropriate for user"
}
Ensure: all keys quoted, no trailing commas, and overall JSON is valid.`;

    try {
      const response = await aiProviderManager.generateResponse(blockPrompt, 'gemini');
      try {
        return parseAIJSONResponse(response);
      } catch (e) {
        const cleaned = fixCommonJSONIssues(String(response));
        try { return JSON.parse(cleaned); } catch (_) {}
        throw e;
      }
    } catch (error) {
      console.error(`Error generating block ${blockTemplate.block_id}:`, error);
      // Return a basic fallback block
      return {
        block_id: blockTemplate.block_id,
        type: blockTemplate.type,
        title: blockTemplate.title,
        content: `Welcome to this learning block about ${blockTemplate.learning_focus}. This content is being generated...`,
        learning_goal: blockTemplate.learning_focus,
        media: {
          image: "/images/mars_base_dark.png",
          audio: "/audio/ai_guidance_chime.mp3",
          "3d_model": "/models/jumping_space-suit1.glb"
        },
        llm_instruction: "Provide supportive, encouraging guidance to help the learner understand this concept.",
        next_block: nextBlockId,
        error: "Generated with fallback due to AI generation error"
      };
    }
  }

  /**
   * Apply advanced tutoring strategies to enhance the lesson
   */
  async applyTutoringStrategies(lesson, userProfile, learningAnalysis) {
    console.log('🎓 Applying advanced tutoring strategies...');

    // Apply Socratic method elements
    lesson = await this.applySocraticMethod(lesson, learningAnalysis);
    
    // Add curriculum sequencing
    lesson = await this.applySequencing(lesson, userProfile, learningAnalysis);
    
    // Enhance with pedagogy-oriented elements
    lesson = await this.applyPedagogicalPrinciples(lesson, learningAnalysis);
    
    // Add adaptive assessment checkpoints
    lesson = await this.addAssessmentCheckpoints(lesson, learningAnalysis);

    return lesson;
  }

  /**
   * Apply Socratic questioning method throughout the lesson
   */
  async applySocraticMethod(lesson, learningAnalysis) {
    // Add Socratic questioning elements to each block
    for (let block of lesson.blocks) {
      if (!block.tutoring_elements) block.tutoring_elements = {};
      
      // Generate context-specific Socratic questions
      if (!block.tutoring_elements.socratic_questions) {
        const questions = await this.generateSocraticQuestions(block, learningAnalysis);
        block.tutoring_elements.socratic_questions = questions;
      }
      
      // Add guided discovery elements
      block.tutoring_elements.discovery_prompts = [
        `What do you think might happen if...?`,
        `How does this connect to what you already know about...?`,
        `What evidence supports this conclusion?`,
        `Can you think of a real-world example of this?`
      ];
    }

    return lesson;
  }

  /**
   * Generate Socratic questions for a specific block
   */
  async generateSocraticQuestions(block, learningAnalysis) {
    const prompt = `CRITICAL: Return ONLY a JSON array. No markdown, no extra text.\n\nGenerate 3-4 Socratic questions for this lesson block that encourage critical thinking and discovery.\n\nBlock Content: ${block.content}\nLearning Goal: ${block.learning_goal}\nUser Learning Style: ${learningAnalysis.learningStyle}\nUser Level: ${learningAnalysis.currentLevel}\n\nGenerate questions that:\n- Lead students to discover concepts themselves\n- Build on prior knowledge\n- Encourage deeper thinking\n- Are appropriate for ${learningAnalysis.currentLevel} level\n\nReturn as JSON array: [\"question1\", \"question2\", \"question3\"]`;

    try {
      const response = await aiProviderManager.generateResponse(prompt, 'gemini');
      return parseAIJSONResponse(response);
    } catch (error) {
      console.error('Error generating Socratic questions:', error);
      return [
        "What do you observe here?",
        "How might this connect to what you already know?",
        "What questions does this raise for you?"
      ];
    }
  }

  /**
   * Apply intelligent curriculum sequencing
   */
  async applySequencing(lesson, userProfile, learningAnalysis) {
    // Add prerequisite checking and knowledge building
    for (let i = 0; i < lesson.blocks.length; i++) {
      const block = lesson.blocks[i];
      
      block.sequencing = {
        prerequisites: i > 0 ? [lesson.blocks[i-1].learning_goal] : [],
        builds_toward: i < lesson.blocks.length - 1 ? lesson.blocks[i+1].learning_goal : null,
        complexity_level: this.calculateComplexityLevel(block, i, lesson.blocks.length),
        cognitive_load: this.assessCognitiveLoad(block, learningAnalysis)
      };
    }

    return lesson;
  }

  /**
   * Apply pedagogical principles
   */
  async applyPedagogicalPrinciples(lesson, learningAnalysis) {
    // Add pedagogical enhancements to each block
    for (let block of lesson.blocks) {
      block.pedagogy = {
        constructivist_elements: [
          "Builds on prior experience",
          "Encourages active knowledge construction",
          "Provides authentic context"
        ],
        scaffolding_strategy: this.determineScaffoldingStrategy(block, learningAnalysis),
        differentiation: {
          for_visual_learners: "Rich imagery and diagrams",
          for_auditory_learners: "Audio explanations and discussions",
          for_kinesthetic_learners: "Interactive elements and simulations"
        },
        metacognitive_prompts: [
          "What strategies are you using to understand this?",
          "How confident do you feel about this concept?",
          "What would you do differently next time?"
        ]
      };
    }

    return lesson;
  }

  /**
   * Add adaptive assessment checkpoints
   */
  async addAssessmentCheckpoints(lesson, learningAnalysis) {
    // Insert assessment blocks at strategic points
    const assessmentInterval = Math.ceil(lesson.blocks.length / 3); // Every third of the lesson
    
    for (let i = assessmentInterval; i < lesson.blocks.length; i += assessmentInterval) {
      // Create formative assessment block
      const assessmentBlock = {
        block_id: `assessment_checkpoint_${i}`,
        type: "assessment",
        title: "Knowledge Check",
        content: "Let's pause and check your understanding so far...",
        learning_goal: "Assess current understanding and identify gaps",
        assessment_type: "formative",
        adaptive_feedback: true,
        remediation_path: "Review previous concepts if needed",
        advancement_path: "Continue to next level if mastered"
      };
      
      // Insert assessment block
      lesson.blocks.splice(i, 0, assessmentBlock);
    }

    return lesson;
  }

  /**
   * Helper methods
   */
  calculateComplexityLevel(block, index, totalBlocks) {
    const progress = index / (totalBlocks - 1);
    if (progress < 0.33) return 'introductory';
    if (progress < 0.67) return 'developing';
    return 'advanced';
  }

  assessCognitiveLoad(block, learningAnalysis) {
    // Simple heuristic based on content length and complexity
    const contentLength = block.content?.length || 0;
    if (contentLength < 500) return 'low';
    if (contentLength < 1000) return 'medium';
    return 'high';
  }

  determineScaffoldingStrategy(block, learningAnalysis) {
    switch (learningAnalysis.recommendedApproach) {
      case 'scaffolded':
        return 'Heavy scaffolding with step-by-step guidance';
      case 'inquiry-based':
        return 'Light scaffolding with questioning prompts';
      case 'problem-based':
        return 'Structured problem-solving support';
      default:
        return 'Adaptive scaffolding based on user responses';
    }
  }

  /**
   * Generate blocks with optimized parallel processing and rate limiting
   */
  async generateBlocksOptimized(blockTemplates, lessonStructure, userProfile, learningAnalysis) {
    const blocks = [];
    const totalBlocks = blockTemplates.length;
    
    // Process blocks in smaller batches to avoid API overload
  const batchSize = Math.min(2, totalBlocks); // Max 2 concurrent blocks to reduce API pressure
    
    for (let i = 0; i < totalBlocks; i += batchSize) {
      const batch = blockTemplates.slice(i, i + batchSize);
      
      console.log(`🔧 Generating block batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalBlocks/batchSize)} (blocks ${i + 1}-${Math.min(i + batchSize, totalBlocks)})`);
      
      // Generate batch in parallel with rate limiting
      const batchPromises = batch.map(async (blockTemplate, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        // Add small delay to prevent API overload
        if (batchIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 500 * batchIndex));
        }
        
        try {
          return await this.generateSingleBlock(
            blockTemplate,
            lessonStructure,
            userProfile,
            learningAnalysis,
            globalIndex,
            blocks.slice(0, globalIndex) // only previous blocks for context
          );
        } catch (error) {
          console.error(`Error generating block ${blockTemplate.block_id}:`, error);
          // Return fallback block instead of failing
          return this.generateFallbackBlock(blockTemplate, globalIndex);
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      blocks.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < totalBlocks) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return blocks;
  }

  /**
   * Generate a fallback block when AI generation fails
   */
  generateFallbackBlock(blockTemplate, index) {
    return {
      block_id: blockTemplate.block_id,
      type: blockTemplate.type,
      title: blockTemplate.title,
      content: `Welcome to this learning block about ${blockTemplate.learning_focus}. This content is being generated...`,
      learning_goal: blockTemplate.learning_focus,
      media: {
        image: "/images/mars_base_dark.png",
        audio: "/audio/ai_guidance_chime.mp3",
        "3d_model": "/models/jumping_space-suit1.glb"
      },
      llm_instruction: "Provide supportive, encouraging guidance to help the learner understand this concept.",
      next_block: index < 10 ? `block_${index + 2}` : null,
      error: "Generated with fallback due to AI generation error",
      tutoring_elements: {
        socratic_questions: [
          "What do you think might happen if...?",
          "How does this connect to what you already know about...?",
          "What evidence supports this conclusion?",
          "Can you think of a real-world example of this?"
        ],
        discovery_prompts: [
          "What do you think might happen if...?",
          "How does this connect to what you already know about...?",
          "What evidence supports this conclusion?",
          "Can you think of a real-world example of this?"
        ]
      },
      sequencing: {
        prerequisites: index > 0 ? [blockTemplate.learning_focus] : [],
        builds_toward: `Next concepts in ${blockTemplate.learning_focus}`,
        complexity_level: "introductory",
        cognitive_load: "low"
      },
      pedagogy: {
        constructivist_elements: ["Builds on prior experience", "Encourages active knowledge construction", "Provides authentic context"],
        scaffolding_strategy: "Heavy scaffolding with step-by-step guidance",
        differentiation: {
          for_visual_learners: "Rich imagery and diagrams",
          for_auditory_learners: "Audio explanations and discussions", 
          for_kinesthetic_learners: "Interactive elements and simulations"
        },
        metacognitive_prompts: [
          "What strategies are you using to understand this?",
          "How confident do you feel about this concept?",
          "What would you do differently next time?"
        ]
      }
    };
  }

  /**
   * Cache generated lesson for performance
   */
  cacheGeneratedLesson(userId, lesson) {
    // Implement LRU cache
    if (this.generatedLessonsCache.size >= this.maxCacheSize) {
      const firstKey = this.generatedLessonsCache.keys().next().value;
      this.generatedLessonsCache.delete(firstKey);
    }
    
    this.generatedLessonsCache.set(`${userId}_${lesson.mission_id}`, {
      lesson,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached lesson if available and recent
   */
  getCachedLesson(userId, lessonId) {
    const key = `${userId}_${lessonId}`;
    const cached = this.generatedLessonsCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < (30 * 60 * 1000)) { // 30 minutes
      return cached.lesson;
    }
    
    return null;
  }
}

// Create singleton instance
const dynamicLessonGenerator = new DynamicLessonGenerator();

module.exports = { dynamicLessonGenerator };