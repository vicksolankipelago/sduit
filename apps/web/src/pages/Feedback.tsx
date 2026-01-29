import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../components/voiceAgent/FeedbackForm.css';

const PROLIFIC_COMPLETION_CODE = 'CS9FLKNW';
const PROLIFIC_COMPLETION_URL = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;

export const FeedbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isProlificUser, setIsProlificUser] = useState(false);
  
  const sessionId = searchParams.get('sessionId') || localStorage.getItem('voice-session-id') || '';
  const journeyName = searchParams.get('journey') || localStorage.getItem('voice-journey-name') || 'the voice experience';

  useEffect(() => {
    const prolificPid = localStorage.getItem('prolific-pid');
    if (prolificPid) {
      setIsProlificUser(true);
    }
  }, []);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          voiceSessionId: sessionId,
          rating,
          comment: comment.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit feedback');
      }

      localStorage.removeItem('voice-agent-preview-mode');
      localStorage.removeItem('voice-agent-launch-journey');
      localStorage.removeItem('voice-session-id');
      localStorage.removeItem('voice-journey-name');
      localStorage.removeItem('prolific-pid');
      localStorage.removeItem('prolific-study-id');
      localStorage.removeItem('prolific-session-id');
      
      setShowThankYou(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    localStorage.removeItem('voice-session-id');
    localStorage.removeItem('voice-journey-name');
    navigate('/');
  };

  const handleProlificRedirect = () => {
    window.location.href = PROLIFIC_COMPLETION_URL;
  };

  const displayRating = hoveredRating || rating;

  if (showThankYou) {
    if (isProlificUser) {
      return (
        <div className="feedback-page">
          <div className="feedback-form thank-you prolific-completion">
            <div className="thank-you-icon">✓</div>
            <h2 className="feedback-form-title">Thank You!</h2>
            <p className="feedback-form-subtitle">
              Your feedback has been submitted successfully.
            </p>
            <div className="prolific-completion-section">
              <p className="prolific-instruction">
                To complete your submission, click the button below to return to Prolific:
              </p>
              <button
                type="button"
                className="prolific-redirect-btn"
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
      <div className="feedback-page">
        <div className="feedback-form thank-you">
          <div className="thank-you-icon">✓</div>
          <h2 className="feedback-form-title">Thank You!</h2>
          <p className="feedback-form-subtitle">
            Your feedback has been submitted successfully.
          </p>
          <p className="thank-you-message">
            You can close this window now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <div className="feedback-form">
        <h2 className="feedback-form-title">How was your experience?</h2>
        <p className="feedback-form-subtitle">Your feedback helps us improve {journeyName}</p>

        <div className="feedback-rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`feedback-star ${star <= displayRating ? 'active' : ''}`}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className="feedback-comment"
          placeholder="Any additional comments? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />

        {error && <p className="feedback-error">{error}</p>}

        <div className="feedback-actions">
          <button
            type="button"
            className="feedback-skip-btn"
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip
          </button>
          <button
            type="button"
            className="feedback-submit-btn"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
