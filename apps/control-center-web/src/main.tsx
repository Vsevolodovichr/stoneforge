import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { ProjectProvider } from '@stoneforge/ui/contexts/ProjectContext';
import './index.css';

document.documentElement.classList.add('dark');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ProjectProvider>
        <RouterProvider router={router} />
      </ProjectProvider>
    </QueryClientProvider>
  </StrictMode>
);
