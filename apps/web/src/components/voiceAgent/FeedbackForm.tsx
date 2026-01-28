import React, { useState, useEffect } from 'react';
import './FeedbackForm.css';

interface FeedbackFormProps {
  voiceSessionId: string;
  onSubmit: () => void;
  onSkip: () => void;
  isPreviewMode?: boolean;
}

const PROLIFIC_COMPLETION_CODE = 'CS9FLKNW';
const PROLIFIC_COMPLETION_URL = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC_COMPLETION_CODE}`;

const FeedbackForm: React.FC<FeedbackFormProps> = ({ voiceSessionId, onSubmit, onSkip, isPreviewMode = false }) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isProlificUser, setIsProlificUser] = useState(false);

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
          voiceSessionId,
          rating,
          comment: comment.trim() || null,
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
        setShowThankYou(true);
      } else {
        onSubmit();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

  const handleProlificRedirect = () => {
    window.location.href = PROLIFIC_COMPLETION_URL;
  };

  if (showThankYou) {
    if (isProlificUser) {
      return (
        <div className="feedback-form-overlay">
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
      <div className="feedback-form-overlay">
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
    <div className="feedback-form-overlay">
      <div className="feedback-form">
        <h2 className="feedback-form-title">How was your experience?</h2>
        <p className="feedback-form-subtitle">Your feedback helps improve the voice agent</p>

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
          {!isPreviewMode && (
            <button
              type="button"
              className="feedback-skip-btn"
              onClick={onSkip}
              disabled={isSubmitting}
            >
              Skip
            </button>
          )}
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

export default FeedbackForm;
