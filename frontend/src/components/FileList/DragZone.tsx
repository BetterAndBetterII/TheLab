import React, { useRef, useState } from 'react';

interface DragZoneProps {
  onFileSelect: (files: FileList) => void;
  multiple?: boolean;
  accept?: string;
}

const DragZone: React.FC<DragZoneProps> = ({
  onFileSelect,
  multiple = true,
  accept
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
    }
  };

  return (
    <div
      className={`
        border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-all duration-300 touch-manipulation min-h-[120px] sm:min-h-[140px] flex items-center justify-center
        ${isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 active:bg-blue-100 dark:active:bg-blue-900/20'
        }
      `}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileInput}
        multiple={multiple}
        accept={accept}
      />
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <div className="text-4xl sm:text-5xl text-blue-500 dark:text-blue-400">📤</div>
        <div className="flex flex-col gap-1 sm:gap-2">
          <p className="m-0 text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
            <span className="hidden sm:inline">点击或拖拽文件到此处上传</span>
            <span className="sm:hidden">点击选择文件上传</span>
          </p>
          <p className="m-0 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            支持{multiple ? '单个或多个' : '单个'}文件
          </p>
        </div>
      </div>
    </div>
  );
};

export default DragZone;
