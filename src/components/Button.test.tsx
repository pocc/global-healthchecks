import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  describe('Rendering', () => {
    it('should render button with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('should apply default variant (primary) classes', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-orange-500');
      expect(button).toHaveClass('hover:bg-orange-600');
    });

    it('should apply secondary variant classes', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-600');
      expect(button).toHaveClass('hover:bg-gray-700');
    });

    it('should apply danger variant classes', () => {
      render(<Button variant="danger">Delete</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-500');
      expect(button).toHaveClass('hover:bg-red-600');
    });

    it('should apply small size classes', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-3');
      expect(button).toHaveClass('py-1.5');
      expect(button).toHaveClass('text-sm');
    });

    it('should apply medium size classes (default)', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-4');
      expect(button).toHaveClass('py-2');
      expect(button).toHaveClass('text-base');
    });

    it('should apply large size classes', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6');
      expect(button).toHaveClass('py-3');
      expect(button).toHaveClass('text-lg');
    });

    it('should apply full width class when fullWidth is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
    });

    it('should merge custom className', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('bg-orange-500'); // Still has default classes
    });
  });

  describe('Tailwind Class Verification', () => {
    it('should have rounded-md class for border radius', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('rounded-md');
    });

    it('should have transition classes for animations', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('transition-all');
      expect(button).toHaveClass('duration-200');
    });

    it('should have focus ring classes for accessibility', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:ring-2');
      expect(button).toHaveClass('focus:ring-offset-2');
    });

    it('should verify disabled state Tailwind classes', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:bg-orange-300');
      expect(button).toBeDisabled();
    });

    it('should have loading spinner with animate-spin class', () => {
      render(<Button loading>Loading</Button>);
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
    });
  });

  describe('User Interactions', () => {
    it('should handle click events', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button');

      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );
      const button = screen.getByRole('button');

      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not trigger onClick when loading', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Button onClick={handleClick} loading>
          Loading
        </Button>
      );
      const button = screen.getByRole('button');

      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard events (Enter/Space)', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Button onClick={handleClick}>Press me</Button>);
      const button = screen.getByRole('button');

      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have button role', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should be focusable', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('should not be focusable when disabled', () => {
      render(<Button disabled>Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should have aria-busy when loading', () => {
      render(<Button loading>Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('should have aria-label when loading', () => {
      render(<Button loading>Test</Button>);
      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeInTheDocument();
    });

    it('should hide loading spinner from screen readers', () => {
      render(<Button loading>Test</Button>);
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should support custom aria attributes', () => {
      render(
        <Button aria-label="Custom label" aria-describedby="description">
          Test
        </Button>
      );
      const button = screen.getByRole('button', { name: /custom label/i });
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });
  });

  describe('Loading State', () => {
    it('should show loading text when loading', () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByText(/loading\.\.\./i)).toBeInTheDocument();
    });

    it('should show children when not loading', () => {
      render(<Button loading={false}>Submit</Button>);
      expect(screen.getByText(/submit/i)).toBeInTheDocument();
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    it('should disable button when loading', () => {
      render(<Button loading>Test</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Snapshot Testing', () => {
    it('should match snapshot for primary button', () => {
      const { container } = render(<Button>Primary</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for secondary button', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for danger button', () => {
      const { container } = render(<Button variant="danger">Delete</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for loading state', () => {
      const { container } = render(<Button loading>Loading</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for disabled state', () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for full width button', () => {
      const { container } = render(<Button fullWidth>Full Width</Button>);
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('HTML Attributes', () => {
    it('should forward native button attributes', () => {
      render(
        <Button type="submit" name="submitBtn" value="submit">
          Submit
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('name', 'submitBtn');
      expect(button).toHaveAttribute('value', 'submit');
    });

    it('should support data attributes', () => {
      render(<Button data-testid="custom-button">Test</Button>);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });
});
