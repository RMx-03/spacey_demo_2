import React, { useState, useEffect } from 'react';

const LessonGenerationStatus = ({ isGenerating, onToggleDynamic }) => {
  const [dynamicEnabled, setDynamicEnabled] = useState(true);

  useEffect(() => {
    const disabled = localStorage.getItem('disable_dynamic_lessons') === 'true';
    setDynamicEnabled(!disabled);
  }, []);

  const toggleDynamic = () => {
    const newState = !dynamicEnabled;
    setDynamicEnabled(newState);
    localStorage.setItem('disable_dynamic_lessons', !newState ? 'true' : 'false');
    if (onToggleDynamic) {
      onToggleDynamic(newState);
    }
  };

  return (
    <div className="lesson-generation-status">
      <div className="status-header">
        <h4>🚀 AI-Powered Learning</h4>
        <div className="toggle-container">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={dynamicEnabled}
              onChange={toggleDynamic}
              disabled={isGenerating}
            />
            <span className="slider"></span>
          </label>
          <span className="toggle-label">
            {dynamicEnabled ? 'Dynamic Lessons Enabled' : 'Static Lessons Only'}
          </span>
        </div>
      </div>

      {isGenerating && (
        <div className="generation-indicator">
          <div className="loading-spinner"></div>
          <div className="status-text">
            <strong>🎯 Generating Personalized Lesson...</strong>
            <p>Creating content tailored specifically for your learning style and interests!</p>
          </div>
        </div>
      )}

      {dynamicEnabled && !isGenerating && (
        <div className="dynamic-enabled-info">
          <p>✨ Your lessons are being personalized based on your learning profile and preferences.</p>
        </div>
      )}

      {!dynamicEnabled && (
        <div className="static-mode-info">
          <p>📄 Using standard lesson content. Enable dynamic lessons for personalized learning!</p>
        </div>
      )}

      <style jsx>{`
        .lesson-generation-status {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .status-header h4 {
          margin: 0;
          font-size: 1.1rem;
        }

        .toggle-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.3);
          transition: 0.3s;
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: #4CAF50;
        }

        input:checked + .slider:before {
          transform: translateX(26px);
        }

        input:disabled + .slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .toggle-label {
          font-size: 0.9rem;
          font-weight: 500;
        }

        .generation-indicator {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          margin-top: 0.5rem;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .status-text {
          flex: 1;
        }

        .status-text strong {
          display: block;
          margin-bottom: 0.25rem;
        }

        .status-text p {
          margin: 0;
          font-size: 0.85rem;
          opacity: 0.9;
        }

        .dynamic-enabled-info,
        .static-mode-info {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .dynamic-enabled-info p,
        .static-mode-info p {
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default LessonGenerationStatus;
