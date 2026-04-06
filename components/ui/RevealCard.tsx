import React, { useState, ReactNode } from 'react';

export type RevealDirection = 'top' | 'bottom' | 'left' | 'right' | 'fade' | 'flip';
export type RevealAnimation = 'slide' | 'zoom' | 'flip' | 'wave';

interface RevealCardProps {
    /** Front content - always visible */
    front: ReactNode;
    /** Back/reveal content - shown on hover */
    reveal: ReactNode;
    /** Direction of the reveal animation */
    direction?: RevealDirection;
    /** Animation style */
    animation?: RevealAnimation;
    /** Card height */
    height?: string;
    /** Card width */
    width?: string;
    /** Custom className */
    className?: string;
    /** Whether to show a subtle border on hover */
    glowOnHover?: boolean;
    /** Color theme for the glow effect */
    glowColor?: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'cyan' | 'purple' | 'orange';
    /** Delay before reveal starts (ms) */
    revealDelay?: number;
    /** Whether the card should maintain a fixed aspect ratio */
    aspectRatio?: 'none' | 'square' | 'video' | 'portrait';
    /** Front content always visible ratio */
    frontRatio?: number;
}

const glowColors = {
    emerald: 'shadow-emerald-500/20 hover:shadow-emerald-500/40',
    blue: 'shadow-blue-500/20 hover:shadow-blue-500/40',
    amber: 'shadow-amber-500/20 hover:shadow-amber-500/40',
    rose: 'shadow-rose-500/20 hover:shadow-rose-500/40',
    violet: 'shadow-violet-500/20 hover:shadow-violet-500/40',
    cyan: 'shadow-cyan-500/20 hover:shadow-cyan-500/40',
    purple: 'shadow-purple-500/20 hover:shadow-purple-500/40',
    orange: 'shadow-orange-500/20 hover:shadow-orange-500/40',
};

const aspectRatioClasses = {
    none: '',
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
};

export const RevealCard: React.FC<RevealCardProps> = ({
    front,
    reveal,
    direction = 'bottom',
    animation = 'slide',
    height = 'auto',
    width = '100%',
    className = '',
    glowOnHover = true,
    glowColor = 'blue',
    revealDelay = 0,
    aspectRatio = 'none',
    frontRatio = 0.5,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    // Animation styles based on direction and animation type
    const getAnimationStyles = (): { front: string; reveal: string; revealActive: string } => {
        const baseStyles = 'absolute inset-0 transition-all duration-500 ease-out';

        const directions: Record<RevealDirection, { front: string; reveal: string; revealActive: string }> = {
            top: {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} -translate-y-full opacity-0`,
                revealActive: 'translate-y-0 opacity-100',
            },
            bottom: {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} translate-y-full opacity-0`,
                revealActive: 'translate-y-0 opacity-100',
            },
            left: {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} -translate-x-full opacity-0`,
                revealActive: 'translate-x-0 opacity-100',
            },
            right: {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} translate-x-full opacity-0`,
                revealActive: 'translate-x-0 opacity-100',
            },
            fade: {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} opacity-0`,
                revealActive: 'opacity-100',
            },
            flip: {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} opacity-0`,
                revealActive: 'opacity-100',
            },
        };

        const selected = { ...directions[direction] };

        if (animation === 'zoom') {
            return {
                front: `${baseStyles} z-10 scale-100`,
                reveal: `${baseStyles} scale-95 opacity-0`,
                revealActive: 'scale-100 opacity-100',
            };
        }

        if (animation === 'wave') {
            return {
                front: `${baseStyles} z-10`,
                reveal: `${baseStyles} scale-y-0 opacity-0 origin-bottom`,
                revealActive: 'scale-y-100 opacity-100',
            };
        }

        return selected;
    };

    const styles = getAnimationStyles();
    const isFlip = animation === 'flip';

    return (
        <div
            className={`
        relative overflow-hidden
        ${aspectRatioClasses[aspectRatio]}
        ${glowOnHover ? glowColors[glowColor] : ''}
        ${className}
      `}
            style={{
                height,
                width,
                perspective: isFlip ? '1000px' : undefined,
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Front Content */}
            <div
                className={`
          ${styles.front}
          ${isFlip ? 'preserve-3d' : ''}
          ${isFlip && isHovered ? 'rotate-y-180' : ''}
          h-full w-full
        `}
                style={{
                    transitionDelay: isHovered ? '0ms' : `${revealDelay}ms`,
                }}
            >
                {front}
            </div>

            {/* Reveal Content */}
            <div
                className={`
          ${isFlip ? `${styles.reveal} preserve-3d` : styles.reveal}
          ${!isFlip && isHovered ? styles.revealActive : ''}
          h-full w-full
          bg-gradient-to-br from-gray-900/95 to-gray-800/95
          dark:from-gray-900 dark:to-gray-800
        `}
                style={{
                    transitionDelay: isHovered ? `${revealDelay}ms` : '0ms',
                }}
            >
                {reveal}
            </div>
        </div>
    );
};

// Simplified version with preset animations
interface HoverCardProps {
    children: ReactNode;
    reveal?: ReactNode;
    direction?: RevealDirection;
    className?: string;
    glowColor?: RevealCardProps['glowColor'];
}

export const HoverCard: React.FC<HoverCardProps> = ({
    children,
    reveal,
    direction = 'bottom',
    className = '',
    glowColor = 'blue',
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const getRevealStyle = () => {
        const positions = {
            top: {
                default: 'translate-y-full opacity-0',
                hover: '-translate-y-0 opacity-100',
            },
            bottom: {
                default: '-translate-y-full opacity-0',
                hover: 'translate-y-0 opacity-100',
            },
            left: {
                default: 'translate-x-full opacity-0',
                hover: 'translate-x-0 opacity-100',
            },
            right: {
                default: '-translate-x-full opacity-0',
                hover: 'translate-x-0 opacity-100',
            },
            fade: {
                default: 'opacity-0',
                hover: 'opacity-100',
            },
            flip: {
                default: 'rotate-y-180',
                hover: 'rotate-y-0',
            },
        };

        return positions[direction];
    };

    const position = getRevealStyle();

    // If no reveal content, just return the children with hover effect
    if (!reveal) {
        return (
            <div
                className={`
          relative overflow-hidden rounded-xl
          shadow-lg hover:shadow-xl
          ${glowColors[glowColor]}
          transition-all duration-300
          ${className}
        `}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            className={`
        relative overflow-hidden rounded-xl
        shadow-lg hover:shadow-xl
        ${glowColors[glowColor]}
        transition-all duration-300
        ${className}
      `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Main Content */}
            <div className="relative z-10">
                {children}
            </div>

            {/* Reveal Overlay */}
            <div
                className={`
          absolute inset-0 
          bg-gradient-to-br from-gray-900/95 to-gray-800/95
          dark:from-gray-900 dark:to-gray-800
          backdrop-blur-sm
          flex items-center justify-center
          transition-all duration-400 ease-out
          ${position.default}
          ${isHovered ? position.hover : ''}
        `}
            >
                <div className="p-4 text-center">
                    {reveal}
                </div>
            </div>
        </div>
    );
};

// Grid wrapper for multiple cards
interface RevealCardGridProps {
    children: ReactNode;
    columns?: 1 | 2 | 3 | 4;
    gap?: number;
    className?: string;
}

export const RevealCardGrid: React.FC<RevealCardGridProps> = ({
    children,
    columns = 3,
    gap = 4,
    className = '',
}) => {
    const gridCols = {
        1: 'grid-cols-1',
        2: 'grid-cols-1 sm:grid-cols-2',
        3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    };

    return (
        <div className={`grid ${gridCols[columns]} gap-${gap} ${className}`}>
            {children}
        </div>
    );
};

export default RevealCard;
