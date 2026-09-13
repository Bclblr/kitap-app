import React, { Component, ErrorInfo, ReactNode } from 'react';
import AppErrorState from '@/components/AppErrorState';
import { reportAppError } from '@/lib/error-monitoring';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uygulama arayüz hatası:', error, info.componentStack);
    void reportAppError(error, {
      kind: 'react_boundary',
      componentStack: info.componentStack,
    });
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <AppErrorState
        fullScreen
        message="Bu ekran beklenmedik bir hata nedeniyle açılamadı. Tekrar deneyebilirsin."
        onAction={this.reset}
      />
    );
  }
}
