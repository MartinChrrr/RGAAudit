import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('@rgaaudit/web', () => {
  it('should be defined', () => {
    render(<App />);
    expect(screen.getByText('RGAAudit')).toBeInTheDocument();
  });
});
