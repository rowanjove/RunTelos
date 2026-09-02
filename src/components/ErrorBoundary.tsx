import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell" style={{ padding: 24, placeContent: 'center' }}>
          <h2>应用出错了</h2>
          <pre className="error-detail">{this.state.error.message}</pre>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
            }}
          >
            重试
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
