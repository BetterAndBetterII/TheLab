import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  className?: string;
}

const Loading: React.FC<LoadingProps> = ({ 
  size = 'medium', 
  text = '加载中...', 
  className 
}) => {
  const spinnerSizes = {
    small: 'w-6 h-6 border-2',
    medium: 'w-10 h-10 border-3',
    large: 'w-14 h-14 border-4',
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-4 animate-fadeIn",
      className
    )}>
      <div className={cn(
        "rounded-full border-t-transparent bg-gradient-to-r from-blue-500 to-blue-400 bg-clip-padding shadow-lg shadow-blue-500/30",
        "animate-[spin_1s_linear_infinite,pulse_2s_ease-in-out_infinite]",
        spinnerSizes[size]
      )}></div>
      {text && (
        <p className="text-sm text-muted-foreground m-0 animate-[fadeInUp_0.5s_ease-out_forwards,pulse-text_2s_ease-in-out_infinite]">
          {text}
        </p>
      )}
    </div>
  );
};

export default Loading;

