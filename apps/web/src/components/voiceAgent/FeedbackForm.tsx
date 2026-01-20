import React, { useState } from 'react';
import './FeedbackForm.css';

interface FeedbackFormProps {
  voiceSessionId: string;
  onSubmit: () => void;
  onSkip: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ voiceSessionId, onSubmit, onSkip }) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      onSubmit();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hoveredRating || rating;

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
          <button
            type="button"
            className="feedback-skip-btn"
            onClick={onSkip}
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

export default FeedbackForm;
