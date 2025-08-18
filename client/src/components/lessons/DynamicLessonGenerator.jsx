import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

/**
 * Dynamic Lesson Generator Component
 * Allows users to create custom lessons on-demand
 */
const DynamicLessonGenerator = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [lessonRequest, setLessonRequest] = useState({
    topic: '',
    difficulty: 'adaptive',
    duration: 20,
    objectives: [''],
    focusAreas: ['']
  });
  const [generatedLesson, setGeneratedLesson] = useState(null);
  const [error, setError] = useState(null);

  const handleInputChange = (field, value) => {
    setLessonRequest(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayInputChange = (field, index, value) => {
    setLessonRequest(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const addArrayItem = (field) => {
    setLessonRequest(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const removeArrayItem = (field, index) => {
    setLessonRequest(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  const generateLesson = async () => {
    if (!lessonRequest.topic.trim()) {
      setError('Please enter a topic for your lesson');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      console.log('🚀 Generating custom lesson:', lessonRequest);

      const response = await fetch('/api/dynamic-lessons/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: {
            id: currentUser?.uid || 'anonymous',
            name: currentUser?.displayName || currentUser?.email || 'Explorer',
            email: currentUser?.email || 'anonymous@example.com'
          },
          customRequest: {
            topic: lessonRequest.topic,
            difficultyLevel: lessonRequest.difficulty,
            estimatedDuration: lessonRequest.duration,
            learningObjectives: lessonRequest.objectives.filter(obj => obj.trim()),
            focusAreas: lessonRequest.focusAreas.filter(area => area.trim()),
            customRequirements: `Custom lesson about ${lessonRequest.topic} for ${currentUser?.displayName || 'learner'}`
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate lesson: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Custom lesson generated:', result.lesson);
      
      setGeneratedLesson(result.lesson);
      
    } catch (error) {
      console.error('❌ Failed to generate lesson:', error);
      setError(`Failed to generate lesson: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const startLesson = () => {
    if (generatedLesson) {
      // Store the generated lesson temporarily and navigate to it
      const lessonId = `dynamic_${generatedLesson.mission_id}`;
      localStorage.setItem(`dynamic_lesson_${lessonId}`, JSON.stringify(generatedLesson));
      navigate(`/lesson/${lessonId}`);
    }
  };

  const popularTopics = [
    'Black Holes and Event Horizons',
    'Mars Colonization Challenges',
    'Exoplanet Discovery Methods',
    'Spacecraft Propulsion Systems',
    'Life in Zero Gravity',
    'Solar System Formation',
    'Space Station Operations',
    'Asteroid Mining Future'
  ];

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">🎯</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">AI Lesson Generator</h2>
          <p className="text-cyan-400/70 text-sm">Create personalized lessons on any space topic</p>
        </div>
      </div>

      {!generatedLesson ? (
        <div className="space-y-6">
          {/* Topic Input */}
          <div>
            <label className="block text-cyan-400 font-medium mb-2">
              What would you like to learn about? *
            </label>
            <input
              type="text"
              value={lessonRequest.topic}
              onChange={(e) => handleInputChange('topic', e.target.value)}
              placeholder="e.g., Black holes, Mars exploration, Spacecraft design..."
              className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 text-white placeholder-cyan-400/50 focus:border-cyan-400 focus:outline-none"
            />
            
            {/* Popular Topics */}
            <div className="mt-3">
              <p className="text-cyan-400/70 text-sm mb-2">Or choose a popular topic:</p>
              <div className="flex flex-wrap gap-2">
                {popularTopics.map((topic, index) => (
                  <button
                    key={index}
                    onClick={() => handleInputChange('topic', topic)}
                    className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-full text-cyan-400 text-sm transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Difficulty and Duration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-400 font-medium mb-2">Difficulty Level</label>
              <select
                value={lessonRequest.difficulty}
                onChange={(e) => handleInputChange('difficulty', e.target.value)}
                className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="beginner">Beginner - New to the topic</option>
                <option value="intermediate">Intermediate - Some knowledge</option>
                <option value="advanced">Advanced - Deep understanding</option>
                <option value="adaptive">Adaptive - AI decides based on my profile</option>
              </select>
            </div>
            
            <div>
              <label className="block text-cyan-400 font-medium mb-2">Duration (minutes)</label>
              <input
                type="number"
                value={lessonRequest.duration}
                onChange={(e) => handleInputChange('duration', parseInt(e.target.value) || 20)}
                min="10"
                max="60"
                className="w-full bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Learning Objectives */}
          <div>
            <label className="block text-cyan-400 font-medium mb-2">Learning Objectives</label>
            {lessonRequest.objectives.map((objective, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => handleArrayInputChange('objectives', index, e.target.value)}
                  placeholder={`Objective ${index + 1}...`}
                  className="flex-1 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-white placeholder-cyan-400/50 focus:border-cyan-400 focus:outline-none"
                />
                {lessonRequest.objectives.length > 1 && (
                  <button
                    onClick={() => removeArrayItem('objectives', index)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => addArrayItem('objectives')}
              className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
            >
              + Add another objective
            </button>
          </div>

          {/* Focus Areas */}
          <div>
            <label className="block text-cyan-400 font-medium mb-2">Focus Areas (Optional)</label>
            {lessonRequest.focusAreas.map((area, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={area}
                  onChange={(e) => handleArrayInputChange('focusAreas', index, e.target.value)}
                  placeholder={`Focus area ${index + 1}...`}
                  className="flex-1 bg-slate-800/50 border border-cyan-500/30 rounded-lg px-4 py-2 text-white placeholder-cyan-400/50 focus:border-cyan-400 focus:outline-none"
                />
                {lessonRequest.focusAreas.length > 1 && (
                  <button
                    onClick={() => removeArrayItem('focusAreas', index)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => addArrayItem('focusAreas')}
              className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
            >
              + Add focus area
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={generateLesson}
            disabled={isGenerating || !lessonRequest.topic.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 text-white font-medium py-4 rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Generating Your Personalized Lesson...
              </div>
            ) : (
              '🚀 Generate AI-Powered Lesson'
            )}
          </button>
        </div>
      ) : (
        // Generated Lesson Preview
        <div className="space-y-6">
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
            <h3 className="text-green-400 font-bold text-lg mb-2">✅ Lesson Generated Successfully!</h3>
            <p className="text-green-300">Your personalized space lesson is ready to launch.</p>
          </div>

          <div className="bg-slate-800/50 rounded-lg p-6 border border-cyan-500/20">
            <h3 className="text-xl font-bold text-white mb-2">{generatedLesson.title}</h3>
            <p className="text-cyan-400/80 mb-4">{generatedLesson.description}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-cyan-400 text-sm font-medium">Duration</div>
                <div className="text-white">{generatedLesson.estimated_duration} minutes</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="text-cyan-400 text-sm font-medium">Blocks</div>
                <div className="text-white">{generatedLesson.blocks?.length || 0} learning blocks</div>
              </div>
            </div>

            {generatedLesson.learning_objectives && (
              <div className="mb-4">
                <div className="text-cyan-400 text-sm font-medium mb-2">Learning Objectives:</div>
                <ul className="list-disc list-inside text-cyan-300 space-y-1">
                  {generatedLesson.learning_objectives.map((objective, index) => (
                    <li key={index}>{objective}</li>
                  ))}
                </ul>
              </div>
            )}

            {generatedLesson.personalization_strategy && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 mb-4">
                <div className="text-cyan-400 text-sm font-medium mb-1">🎯 Personalization Applied</div>
                <div className="text-cyan-300 text-sm">{generatedLesson.personalization_strategy}</div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={startLesson}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-medium py-4 rounded-lg transition-all"
            >
              🚀 Start This Lesson
            </button>
            <button
              onClick={() => {
                setGeneratedLesson(null);
                setError(null);
              }}
              className="px-6 py-4 bg-slate-700/50 hover:bg-slate-700/70 border border-cyan-500/30 text-cyan-400 rounded-lg transition-colors"
            >
              Generate Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicLessonGenerator;
