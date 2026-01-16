import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for SDUI Components
 *
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the entire application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[ErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ''}]`,
        error,
        errorInfo.componentStack
      );
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-icon">⚠️</div>
          <h3 className="error-boundary-title">
            {this.props.componentName
              ? `Error in ${this.props.componentName}`
              : 'Something went wrong'}
          </h3>
          <p className="error-boundary-message">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button className="error-boundary-retry" onClick={this.handleRetry}>
            Try Again
          </button>
          {process.env.NODE_ENV !== 'production' && this.state.errorInfo && (
            <details className="error-boundary-details">
              <summary>Error Details</summary>
              <pre>{this.state.error?.stack}</pre>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary componentName={componentName || WrappedComponent.displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `WithErrorBoundary(${
    componentName || WrappedComponent.displayName || 'Component'
  })`;

  return WithErrorBoundary;
}

/**
 * Specialized Error Boundary for SDUI Screen rendering
 */
export const ScreenErrorBoundary: React.FC<{
  children: ReactNode;
  screenId?: string;
}> = ({ children, screenId }) => (
  <ErrorBoundary
    componentName={screenId ? `Screen:${screenId}` : 'ScreenPreview'}
    fallback={
      <div className="screen-error-fallback">
        <div className="screen-error-icon">📱</div>
        <p>Failed to render screen{screenId ? `: ${screenId}` : ''}</p>
        <p className="screen-error-hint">
          Check the screen configuration for errors
        </p>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

/**
 * Specialized Error Boundary for SDUI Elements
 */
export const ElementErrorBoundary: React.FC<{
  children: ReactNode;
  elementType?: string;
  elementId?: string;
}> = ({ children, elementType, elementId }) => (
  <ErrorBoundary
    componentName={`Element:${elementType || 'unknown'}${elementId ? `#${elementId}` : ''}`}
    fallback={
      <div className="element-error-fallback">
        <span className="element-error-badge">Error</span>
        <span className="element-error-type">{elementType || 'Element'}</span>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
