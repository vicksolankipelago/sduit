import React, { useState, useEffect } from 'react';
import './FeedbackSurvey.css';

interface FeedbackSurveyProps {
  voiceSessionId: string;
  onSubmit: () => void;
  onSkip: () => void;
  isPreviewMode?: boolean;
}

type SurveyStep = 'overall' | 'naturalness' | 'helpfulness' | 'download' | 'openEnded' | 'submitting' | 'thankYou';

const PROLIFIC_COMPLETION_CODE = 'CS9FLKNW';
const PROLIFIC_COMPLETION_URL = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;

const STEPS: SurveyStep[] = ['overall', 'naturalness', 'helpfulness', 'download', 'openEnded'];

const FeedbackSurvey: React.FC<FeedbackSurveyProps> = ({ 
  voiceSessionId, 
  onSubmit, 
  onSkip, 
  isPreviewMode = false 
}) => {
  const [currentStep, setCurrentStep] = useState<SurveyStep>('overall');
  const [isProlificUser, setIsProlificUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Survey responses
  const [overallRating, setOverallRating] = useState<number>(0);
  const [hoveredOverall, setHoveredOverall] = useState<number>(0);
  const [naturalnessRating, setNaturalnessRating] = useState<number>(0);
  const [hoveredNaturalness, setHoveredNaturalness] = useState<number>(0);
  const [helpfulnessRating, setHelpfulnessRating] = useState<number>(0);
  const [hoveredHelpfulness, setHoveredHelpfulness] = useState<number>(0);
  const [wouldDownload, setWouldDownload] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [likedMost, setLikedMost] = useState('');
  const [improvements, setImprovements] = useState('');
  const [additionalComments, setAdditionalComments] = useState('');

  useEffect(() => {
    const prolificPid = localStorage.getItem('prolific-pid');
    if (prolificPid) {
      setIsProlificUser(true);
    }
  }, []);

  const getCurrentStepIndex = () => STEPS.indexOf(currentStep as any);
  const getTotalSteps = () => STEPS.length;

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'overall':
        return overallRating > 0;
      case 'naturalness':
        return naturalnessRating > 0;
      case 'helpfulness':
        return helpfulnessRating > 0;
      case 'download':
        return wouldDownload !== null;
      case 'openEnded':
        return true;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1]);
    } else {
      handleSubmit();
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setCurrentStep('submitting');
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceSessionId,
          rating: overallRating,
          conversationNaturalness: naturalnessRating || null,
          informationHelpfulness: helpfulnessRating || null,
          wouldDownloadApp: wouldDownload,
          likedMost: likedMost.trim() || null,
          improvements: improvements.trim() || null,
          comment: additionalComments.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit feedback');
      }

      if (isPreviewMode) {
        localStorage.removeItem('voice-agent-preview-mode');
        localStorage.removeItem('voice-agent-launch-journey');
        localStorage.removeItem('prolific-pid');
        localStorage.removeItem('prolific-study-id');
        localStorage.removeItem('prolific-session-id');
      }

      setCurrentStep('thankYou');
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
      setCurrentStep('openEnded');
    }
  };

  const handleProlificRedirect = () => {
    window.location.href = PROLIFIC_COMPLETION_URL;
  };

  const renderStarRating = (
    value: number,
    hovered: number,
    setValue: (n: number) => void,
    setHovered: (n: number) => void
  ) => {
    const displayValue = hovered || value;
    return (
      <div className="survey-star-rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`survey-star ${star <= displayValue ? 'active' : ''}`}
            onClick={() => setValue(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
      </div>
    );
  };

  const renderProgressBar = () => {
    const currentIndex = getCurrentStepIndex();
    const progress = ((currentIndex + 1) / getTotalSteps()) * 100;
    
    return (
      <div className="survey-progress">
        <div className="survey-progress-bar">
          <div 
            className="survey-progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="survey-progress-text">
          Question {currentIndex + 1} of {getTotalSteps()}
        </span>
      </div>
    );
  };

  // Thank you screen
  if (currentStep === 'thankYou') {
    if (isProlificUser) {
      return (
        <div className="survey-container">
          <div className="survey-content thank-you">
            <div className="thank-you-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>
            <h1 className="survey-title">Thank You!</h1>
            <p className="survey-subtitle">
              Your feedback has been submitted successfully.
            </p>
            <div className="prolific-section">
              <p className="prolific-instruction">
                To complete your submission, click the button below to return to Prolific:
              </p>
              <button
                type="button"
                className="survey-btn-primary prolific-btn"
                onClick={handleProlificRedirect}
              >
                Return to Prolific
              </button>
              <p className="prolific-code-label">
                Or copy this completion code:
              </p>
              <div className="prolific-code-box">
                <code className="prolific-code">{PROLIFIC_COMPLETION_CODE}</code>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="survey-container">
        <div className="survey-content thank-you">
          <div className="thank-you-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </div>
          <h1 className="survey-title">Thank You!</h1>
          <p className="survey-subtitle">
            Your feedback has been submitted successfully.
          </p>
          <p className="thank-you-message">
            We appreciate you taking the time to share your experience.
          </p>
          {!isPreviewMode && (
            <button
              type="button"
              className="survey-btn-primary"
              onClick={onSubmit}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    );
  }

  // Submitting screen
  if (currentStep === 'submitting') {
    return (
      <div className="survey-container">
        <div className="survey-content submitting">
          <div className="survey-spinner" />
          <h1 className="survey-title">Submitting your feedback...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-container">
      <div className="survey-content">
        {renderProgressBar()}

        {error && (
          <div className="survey-error">
            {error}
          </div>
        )}

        {/* Step 1: Overall Experience */}
        {currentStep === 'overall' && (
          <div className="survey-step">
            <h1 className="survey-title">How was your overall experience?</h1>
            <p className="survey-subtitle">
              Rate your experience with the voice agent conversation
            </p>
            {renderStarRating(overallRating, hoveredOverall, setOverallRating, setHoveredOverall)}
            <div className="survey-rating-labels">
              <span>Not great</span>
              <span>Excellent</span>
            </div>
          </div>
        )}

        {/* Step 2: Conversation Naturalness */}
        {currentStep === 'naturalness' && (
          <div className="survey-step">
            <h1 className="survey-title">How natural did the conversation feel?</h1>
            <p className="survey-subtitle">
              Did the agent understand you and respond naturally?
            </p>
            {renderStarRating(naturalnessRating, hoveredNaturalness, setNaturalnessRating, setHoveredNaturalness)}
            <div className="survey-rating-labels">
              <span>Very robotic</span>
              <span>Very natural</span>
            </div>
          </div>
        )}

        {/* Step 3: Information Helpfulness */}
        {currentStep === 'helpfulness' && (
          <div className="survey-step">
            <h1 className="survey-title">How helpful was the information provided?</h1>
            <p className="survey-subtitle">
              Did you find the conversation valuable and informative?
            </p>
            {renderStarRating(helpfulnessRating, hoveredHelpfulness, setHelpfulnessRating, setHoveredHelpfulness)}
            <div className="survey-rating-labels">
              <span>Not helpful</span>
              <span>Very helpful</span>
            </div>
          </div>
        )}

        {/* Step 4: Would Download App */}
        {currentStep === 'download' && (
          <div className="survey-step">
            <h1 className="survey-title">Would you download the Pelago app?</h1>
            <p className="survey-subtitle">
              Based on this experience, how likely are you to try the full app?
            </p>
            <div className="survey-download-options">
              <button
                type="button"
                className={`survey-download-btn ${wouldDownload === 'yes' ? 'selected' : ''}`}
                onClick={() => setWouldDownload('yes')}
              >
                <div className="download-btn-icon yes">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                </div>
                <span className="download-btn-text">Yes, definitely</span>
              </button>
              <button
                type="button"
                className={`survey-download-btn ${wouldDownload === 'maybe' ? 'selected' : ''}`}
                onClick={() => setWouldDownload('maybe')}
              >
                <div className="download-btn-icon maybe">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z" />
                  </svg>
                </div>
                <span className="download-btn-text">Maybe</span>
              </button>
              <button
                type="button"
                className={`survey-download-btn ${wouldDownload === 'no' ? 'selected' : ''}`}
                onClick={() => setWouldDownload('no')}
              >
                <div className="download-btn-icon no">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                  </svg>
                </div>
                <span className="download-btn-text">No, not interested</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Open-ended Questions */}
        {currentStep === 'openEnded' && (
          <div className="survey-step open-ended">
            <h1 className="survey-title">Tell us more (optional)</h1>
            <p className="survey-subtitle">
              Your detailed feedback helps us improve
            </p>

            <div className="survey-textarea-group">
              <label className="survey-label">What did you like most about the experience?</label>
              <textarea
                className="survey-textarea"
                placeholder="The conversation felt personal and understanding..."
                value={likedMost}
                onChange={(e) => setLikedMost(e.target.value)}
                rows={3}
              />
            </div>

            <div className="survey-textarea-group">
              <label className="survey-label">What could we improve?</label>
              <textarea
                className="survey-textarea"
                placeholder="It would be helpful if..."
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                rows={3}
              />
            </div>

            <div className="survey-textarea-group">
              <label className="survey-label">Any other comments?</label>
              <textarea
                className="survey-textarea"
                placeholder="Additional thoughts..."
                value={additionalComments}
                onChange={(e) => setAdditionalComments(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="survey-navigation">
          {getCurrentStepIndex() > 0 && (
            <button
              type="button"
              className="survey-btn-secondary"
              onClick={goToPreviousStep}
            >
              Back
            </button>
          )}
          
          {!isPreviewMode && getCurrentStepIndex() === 0 && (
            <button
              type="button"
              className="survey-btn-skip"
              onClick={onSkip}
            >
              Skip survey
            </button>
          )}

          <button
            type="button"
            className="survey-btn-primary"
            onClick={goToNextStep}
            disabled={!canProceed()}
          >
            {currentStep === 'openEnded' ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackSurvey;
