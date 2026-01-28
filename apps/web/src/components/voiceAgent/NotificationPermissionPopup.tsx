import React from 'react';
import './NotificationPermissionPopup.css';

interface NotificationPermissionPopupProps {
  onAllow: () => void;
  onDeny: () => void;
}

export const NotificationPermissionPopup: React.FC<NotificationPermissionPopupProps> = ({
  onAllow,
  onDeny,
}) => {
  return (
    <div className="notification-popup-overlay">
      <div className="notification-popup">
        <div className="notification-popup-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="24" fill="#E8F5E9"/>
            <path
              d="M24 34C25.1 34 26 33.1 26 32H22C22 33.1 22.9 34 24 34ZM30 28V23C30 19.93 28.36 17.36 25.5 16.68V16C25.5 15.17 24.83 14.5 24 14.5C23.17 14.5 22.5 15.17 22.5 16V16.68C19.63 17.36 18 19.92 18 23V28L16 30V31H32V30L30 28Z"
              fill="#4CAF50"
            />
          </svg>
        </div>
        <div className="notification-popup-content">
          <h3 className="notification-popup-title">"Pelago" Would Like to Send You Notifications</h3>
          <p className="notification-popup-description">
            Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.
          </p>
        </div>
        <div className="notification-popup-actions">
          <button 
            className="notification-popup-btn notification-popup-btn-deny"
            onClick={onDeny}
          >
            Don't Allow
          </button>
          <button 
            className="notification-popup-btn notification-popup-btn-allow"
            onClick={onAllow}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermissionPopup;
