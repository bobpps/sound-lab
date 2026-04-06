import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

export function createTestWrapper({
  queryClient = createTestQueryClient(),
  route = "/",
}: {
  queryClient?: QueryClient;
  route?: string;
} = {}) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    route = "/",
  }: {
    queryClient?: QueryClient;
    route?: string;
  } = {},
) {
  const wrapper = createTestWrapper({ queryClient, route });

  return {
    queryClient,
    ...render(ui, { wrapper }),
  };
}
