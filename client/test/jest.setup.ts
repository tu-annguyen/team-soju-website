import '@testing-library/jest-dom';

// Provide a basic matchMedia implementation for components that use it
if (typeof window !== 'undefined' && !window.matchMedia) {
  // @ts-expect-error - jsdom does not define matchMedia by default
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
}
