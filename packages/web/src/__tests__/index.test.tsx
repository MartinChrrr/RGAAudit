import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('@rgaaudit/web', () => {
  it('renders the app with routing', () => {
    render(<App />);
    expect(screen.getByText('RGAAudit')).toBeInTheDocument();
  });
});
