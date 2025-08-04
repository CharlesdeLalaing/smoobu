import React from "react";
import { useTranslation } from "react-i18next";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error("React Error Boundary caught an error:", error, errorInfo);

    // Store error details for debugging
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });

    // Log to error tracking service if available
    if (window.gtag) {
      window.gtag("event", "exception", {
        description: error.toString(),
        fatal: false,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="max-w-md p-6 border border-red-200 rounded-lg bg-red-50">
            <h2 className="mb-4 text-xl font-semibold text-red-800">
              {this.props.title || "Something went wrong"}
            </h2>
            <p className="mb-4 text-gray-700">
              {this.props.message ||
                "An error occurred while loading this section. Please refresh the page to try again."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-white transition-colors bg-red-600 rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-sm text-left text-gray-600">
                <summary className="font-medium cursor-pointer">
                  Error Details (Dev Only)
                </summary>
                <pre className="p-2 mt-2 overflow-auto bg-gray-100 rounded">
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Wrapper component for functional components with translation
export const BookingErrorBoundary = ({ children, title, message }) => {
  return (
    <ErrorBoundary title={title} message={message}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;

