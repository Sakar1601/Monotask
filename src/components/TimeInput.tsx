
import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  className = "",
  placeholder = "Select time"
}) => {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('tabular-nums transition-shadow duration-200 focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]', className)}
      placeholder={placeholder}
    />
  );
};

export default TimeInput;
