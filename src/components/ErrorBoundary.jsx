import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-6 max-w-sm">This page hit an error. Your data is safe.</p>
          <div className="flex gap-3">
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.history.back() }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg min-h-[44px]"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-6 py-2 border border-gray-300 rounded-lg min-h-[44px]"
            >
              Dashboard
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
