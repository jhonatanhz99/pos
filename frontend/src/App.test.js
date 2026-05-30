import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login page title', () => {
  render(<App />);
  const linkElement = screen.getByText(/Iniciar sesión/i);
  expect(linkElement).toBeInTheDocument();
});

