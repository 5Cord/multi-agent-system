import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { Theme, presetGpnDefault } from '@consta/uikit/Theme';

import { PostsPage, SinglePostPage, GeneratePostPage, GenerateStoryPage, HeaderPage, Page404 } from 'pages';
import { ErrorBoundary } from 'features';

import 'styles/styles.scss';

const App = () => {
  return (
    <Theme preset={presetGpnDefault}>
      <BrowserRouter>
        <HeaderPage />

        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<PostsPage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/posts/:id" element={<SinglePostPage />} />
            <Route path="/posts/generation" element={<GeneratePostPage />} />
            <Route path="/posts/story" element={<GenerateStoryPage />} />
            <Route path="*" element={<Page404 />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </Theme>
  );
};

export default App;
