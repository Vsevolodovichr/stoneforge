import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { DashboardPage } from './routes/dashboard';

const rootRoute = createRootRoute({
  component: () => {
    throw redirect({ to: '/dashboard' });
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}