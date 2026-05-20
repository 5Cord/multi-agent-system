import { Component, ReactNode, ErrorInfo } from 'react';

import { Button } from '@consta/uikit/Button';
import { Layout } from '@consta/uikit/Layout';
import { ResponsesConnectionError } from '@consta/uikit/ResponsesConnectionError';
import { IconHome } from '@consta/icons/IconHome';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Layout style={{ justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <ResponsesConnectionError
            title="Что-то пошло не так"
            description="Произошла непредвиденная ошибка. Попробуйте вернуться на главную."
            actions={
              <Button
                label="На главную"
                iconLeft={IconHome}
                onClick={() => {
                  this.setState({ hasError: false });
                  window.location.assign('/posts');
                }}
              />
            }
          />
        </Layout>
      );
    }

    return this.props.children;
  }
}
