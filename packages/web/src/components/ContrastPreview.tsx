import { useState, type HTMLAttributes, type ReactEventHandler } from 'react';

interface ContrastPreviewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'> {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  onImageError?: ReactEventHandler<HTMLImageElement>;
}

/**
 * Affiche une image sans la modifier et permet de basculer le fond entre
 * noir et blanc. Le contraste est utile pour les SVG/images transparents.
 */
export default function ContrastPreview({
  src,
  alt = '',
  width = 80,
  height = 80,
  onImageError,
  className = '',
  ...containerProps
}: ContrastPreviewProps) {
  const [darkBackground, setDarkBackground] = useState(true);

  return (
    <div
      {...containerProps}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded border p-2 transition-colors duration-200 ${
        darkBackground ? 'border-gray-700 bg-black' : 'border-gray-300 bg-white'
      } ${className}`}
      style={{ width, height, ...containerProps.style }}
    >
      <img
        src={src}
        alt={alt}
        className="block h-full w-full object-contain"
        loading="lazy"
        onError={onImageError}
      />
      <button
        type="button"
        onClick={() => setDarkBackground((current) => !current)}
        aria-label={darkBackground ? 'Afficher sur fond blanc' : 'Afficher sur fond noir'}
        title={darkBackground ? 'Afficher sur fond blanc' : 'Afficher sur fond noir'}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700/90 text-[11px] leading-none text-white shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        ◐
      </button>
    </div>
  );
}
