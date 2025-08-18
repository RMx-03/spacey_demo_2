import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX } from 'lucide-react';

// Import existing lesson components
import NarrationBlock from '../lesson/NarrationBlock';
import ChoiceBlock from '../lesson/ChoiceBlock';
import ReflectionBlock from '../lesson/ReflectionBlock';
import QuizBlock from '../lesson/QuizBlock';
import MediaDisplay from '../lesson/MediaDisplay';

const DynamicLessonCanvas = ({ 
  lesson, 
  currentBlockId, 
  onBlockChange, 
  onUserChoice,
  onSendMessage,
  chatHistory = []
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const canvasRef = useRef(null);

  // Find current block index
  useEffect(() => {
    if (lesson?.blocks && currentBlockId) {
      const index = lesson.blocks.findIndex(block => block.block_id === currentBlockId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [lesson, currentBlockId]);

  // Get current block
  const currentBlock = lesson?.blocks?.[currentIndex];

  // Handle navigation
  const goToNextBlock = () => {
    if (currentIndex < lesson.blocks.length - 1) {
      const nextBlock = lesson.blocks[currentIndex + 1];
      setCurrentIndex(currentIndex + 1);
      onBlockChange(nextBlock.block_id);
    }
  };

  const goToPreviousBlock = () => {
    if (currentIndex > 0) {
      const prevBlock = lesson.blocks[currentIndex - 1];
      setCurrentIndex(currentIndex - 1);
      onBlockChange(prevBlock.block_id);
    }
  };

  // Handle user interactions
  const handleChoice = (choice) => {
    if (onUserChoice) {
      onUserChoice(choice);
    }
    // Auto-advance to next block after choice
    if (choice.next_block) {
      const nextBlockIndex = lesson.blocks.findIndex(block => block.block_id === choice.next_block);
      if (nextBlockIndex !== -1) {
        setCurrentIndex(nextBlockIndex);
        onBlockChange(choice.next_block);
      }
    } else {
      goToNextBlock();
    }
  };

  if (!lesson || !currentBlock) {
    return (
      <div className="dynamic-lesson-canvas loading">
        <div className="canvas-container">
          <div className="loading-spinner"></div>
          <p>Loading dynamic lesson content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dynamic-lesson-canvas">
      {/* Lesson Header */}
      <div className="lesson-header">
        <div className="lesson-info">
          <h1 className="lesson-title">{lesson.title}</h1>
          <div className="lesson-meta">
            <span className="block-counter">{currentIndex + 1} / {lesson.blocks.length}</span>
            {lesson.personalization_applied && (
              <span className="personalized-badge">✨ Personalized</span>
            )}
            {lesson.difficulty_level && (
              <span className="difficulty-badge">{lesson.difficulty_level}</span>
            )}
          </div>
        </div>
        
        {/* Lesson Controls */}
        <div className="lesson-controls">
          <button 
            onClick={goToPreviousBlock} 
            disabled={currentIndex === 0}
            className="control-btn"
            title="Previous Block"
          >
            <SkipBack size={20} />
          </button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="control-btn play-btn"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button 
            onClick={goToNextBlock} 
            disabled={currentIndex === lesson.blocks.length - 1}
            className="control-btn"
            title="Next Block"
          >
            <SkipForward size={20} />
          </button>
          
          <button 
            onClick={() => setAudioMuted(!audioMuted)}
            className="control-btn"
            title={audioMuted ? "Unmute" : "Mute"}
          >
            {audioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="canvas-container" ref={canvasRef}>
        {/* Block Content */}
        <div className="block-content">
          {/* Current Block Display */}
          <div className="current-block">
            <div className="block-header">
              <h2 className="block-title">{currentBlock.title}</h2>
              <span className="block-type">{currentBlock.type}</span>
            </div>

            {/* Media Display */}
            {currentBlock.media && (
              <div className="block-media">
                <MediaDisplay 
                  media={currentBlock.media}
                  autoPlay={isPlaying && !audioMuted}
                  muted={audioMuted}
                />
              </div>
            )}

            {/* Block Component */}
            <div className="block-component">
              {currentBlock.type === 'narration' && (
                <NarrationBlock
                  content={currentBlock.content}
                  learningGoal={currentBlock.learning_goal}
                  onContinue={goToNextBlock}
                />
              )}

              {currentBlock.type === 'choice' && (
                <ChoiceBlock
                  content={currentBlock.content}
                  choices={currentBlock.choices || []}
                  onChoice={handleChoice}
                />
              )}

              {currentBlock.type === 'reflection' && (
                <ReflectionBlock
                  content={currentBlock.content}
                  questions={currentBlock.reflection_questions || []}
                  onReflectionComplete={goToNextBlock}
                />
              )}

              {currentBlock.type === 'quiz' && (
                <QuizBlock
                  content={currentBlock.content}
                  questions={currentBlock.quiz_questions || []}
                  onQuizComplete={goToNextBlock}
                />
              )}

              {currentBlock.type === 'interactive' && (
                <div className="interactive-block">
                  <div className="content">{currentBlock.content}</div>
                  <div className="interactive-area">
                    <p>Interactive content: {currentBlock.learning_goal}</p>
                    <button onClick={goToNextBlock} className="continue-btn">
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {currentBlock.type === 'assessment' && (
                <div className="assessment-block">
                  <div className="content">{currentBlock.content}</div>
                  <div className="assessment-area">
                    <p>Assessment: {currentBlock.learning_goal}</p>
                    <button onClick={goToNextBlock} className="continue-btn">
                      Complete Assessment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Personalization Info */}
            {currentBlock.personalization && (
              <div className="personalization-info">
                <div className="personalization-badge">
                  🎯 Personalized for your learning style
                </div>
                <div className="adaptation-details">
                  {currentBlock.personalization.style_adapted && (
                    <p><strong>Learning Style:</strong> {currentBlock.personalization.style_adapted}</p>
                  )}
                  {currentBlock.personalization.difficulty_adapted && (
                    <p><strong>Difficulty:</strong> {currentBlock.personalization.difficulty_adapted}</p>
                  )}
                </div>
              </div>
            )}

            {/* Tutoring Elements */}
            {currentBlock.tutoring_elements && (
              <div className="tutoring-elements">
                {currentBlock.tutoring_elements.socratic_questions?.length > 0 && (
                  <div className="socratic-questions">
                    <h4>Think About:</h4>
                    <ul>
                      {currentBlock.tutoring_elements.socratic_questions.map((question, i) => (
                        <li key={i}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentBlock.tutoring_elements.real_world_connections?.length > 0 && (
                  <div className="real-world-connections">
                    <h4>Real-World Connections:</h4>
                    <ul>
                      {currentBlock.tutoring_elements.real_world_connections.map((connection, i) => (
                        <li key={i}>{connection}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${((currentIndex + 1) / lesson.blocks.length) * 100}%` }}
          ></div>
        </div>

        {/* Block Navigation */}
        <div className="block-navigation">
          {lesson.blocks.map((block, index) => (
            <button
              key={block.block_id}
              className={`nav-block ${index === currentIndex ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`}
              onClick={() => {
                setCurrentIndex(index);
                onBlockChange(block.block_id);
              }}
              title={block.title}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .dynamic-lesson-canvas {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
          color: white;
          border-radius: 12px;
          overflow: hidden;
        }

        .lesson-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        .lesson-info {
          flex: 1;
        }

        .lesson-title {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0 0 0.5rem 0;
          color: #00d4ff;
        }

        .lesson-meta {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .block-counter {
          background: rgba(0, 212, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.9rem;
        }

        .personalized-badge {
          background: linear-gradient(45deg, #ff6b6b, #feca57);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .difficulty-badge {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
        }

        .lesson-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .control-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 0.75rem;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .control-btn:hover:not(:disabled) {
          background: rgba(0, 212, 255, 0.3);
          border-color: #00d4ff;
        }

        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .play-btn {
          background: rgba(0, 212, 255, 0.2);
          border-color: #00d4ff;
        }

        .canvas-container {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top: 4px solid #00d4ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .block-content {
          margin-bottom: 2rem;
        }

        .current-block {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 2rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .block-title {
          font-size: 1.5rem;
          font-weight: bold;
          color: #00d4ff;
          margin: 0;
        }

        .block-type {
          background: rgba(255, 255, 255, 0.2);
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.9rem;
          text-transform: capitalize;
        }

        .block-media {
          margin-bottom: 2rem;
        }

        .block-component {
          margin-bottom: 2rem;
        }

        .interactive-block,
        .assessment-block {
          text-align: center;
        }

        .continue-btn {
          background: linear-gradient(45deg, #00d4ff, #0099cc);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 25px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          margin-top: 1rem;
          transition: transform 0.3s ease;
        }

        .continue-btn:hover {
          transform: translateY(-2px);
        }

        .personalization-info {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(255, 107, 107, 0.1);
          border-radius: 8px;
          border-left: 4px solid #ff6b6b;
        }

        .personalization-badge {
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .adaptation-details p {
          margin: 0.25rem 0;
          font-size: 0.9rem;
        }

        .tutoring-elements {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(0, 212, 255, 0.1);
          border-radius: 8px;
          border-left: 4px solid #00d4ff;
        }

        .tutoring-elements h4 {
          margin: 0 0 0.5rem 0;
          color: #00d4ff;
        }

        .tutoring-elements ul {
          margin: 0;
          padding-left: 1rem;
        }

        .tutoring-elements li {
          margin: 0.25rem 0;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
          margin: 1rem 0;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00d4ff, #0099cc);
          border-radius: 2px;
          transition: width 0.3s ease;
        }

        .block-navigation {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .nav-block {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .nav-block:hover {
          border-color: #00d4ff;
          background: rgba(0, 212, 255, 0.2);
        }

        .nav-block.active {
          border-color: #00d4ff;
          background: #00d4ff;
          color: #000;
        }

        .nav-block.completed {
          border-color: #4ecdc4;
          background: rgba(78, 205, 196, 0.3);
        }
      `}</style>
    </div>
  );
};

export default DynamicLessonCanvas;
