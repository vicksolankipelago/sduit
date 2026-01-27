import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './TermsModal.css';

interface TermsModalProps {
  onAccept?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ onAccept }) => {
  const { acceptTerms } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setIsSubmitting(true);
    setError(null);
    
    const result = await acceptTerms();
    
    if (result.success) {
      onAccept?.();
    } else {
      setError(result.error || 'Failed to accept terms');
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="terms-modal-overlay">
      <div className="terms-modal">
        <div className="terms-modal-header">
          <h2>Terms & Conditions</h2>
          <p className="terms-modal-subtitle">Please review and accept to continue</p>
        </div>
        
        <div className="terms-modal-content">
          <div className="terms-section">
            <h3>Data Usage & Privacy</h3>
            <p>
              By using Pelago Health's voice-enabled services, you agree to the following terms 
              regarding your data and privacy:
            </p>
          </div>

          <div className="terms-section">
            <h3>Voice Recording Consent</h3>
            <p>
              I understand and consent that Pelago Health may record, store, and process my voice 
              interactions during sessions. These recordings may be used to:
            </p>
            <ul>
              <li>Provide and improve the quality of services</li>
              <li>Train and enhance our AI models to better serve members</li>
              <li>Conduct research to advance behavioral health outcomes</li>
              <li>Ensure quality assurance and compliance</li>
            </ul>
          </div>

          <div className="terms-section">
            <h3>Data Processing</h3>
            <p>
              I consent to Pelago Health collecting, processing, and analyzing my personal data, 
              including but not limited to:
            </p>
            <ul>
              <li>Voice recordings and transcriptions</li>
              <li>Session data and interaction patterns</li>
              <li>Progress information and health-related inputs</li>
              <li>Feedback and survey responses</li>
            </ul>
          </div>

          <div className="terms-section">
            <h3>AI Model Training</h3>
            <p>
              I understand that my anonymized data may be used to train and improve Pelago Health's 
              AI systems. This helps create more effective and personalized support for all members. 
              Your data will be handled in accordance with applicable privacy laws and Pelago Health's 
              privacy policy.
            </p>
          </div>

          <div className="terms-section">
            <h3>Data Protection</h3>
            <p>
              Pelago Health is committed to protecting your privacy and data security. All data is 
              encrypted, stored securely, and accessed only by authorized personnel. You may request 
              access to your data or its deletion at any time by contacting our support team.
            </p>
          </div>
        </div>

        {error && (
          <div className="terms-modal-error">
            {error}
          </div>
        )}

        <div className="terms-modal-actions">
          <button 
            className="terms-accept-btn"
            onClick={handleAccept}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : 'I Agree to the Terms & Conditions'}
          </button>
          <p className="terms-modal-note">
            By clicking "I Agree", you confirm that you have read, understood, and agree to 
            Pelago Health's terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
