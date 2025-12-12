
import React from 'react';
import { Input } from '@/components/ui/input';

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
      className={`bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-black dark:text-white ${className}`}
      placeholder={placeholder}
    />
  );
};

export default TimeInput;
