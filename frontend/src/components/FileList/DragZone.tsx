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
        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300
        ${isDragging
          ? 'border-blue-600 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-blue-600 hover:bg-gray-100'
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
      <div className="flex flex-col items-center gap-4">
        <div className="text-3xl text-blue-600">📤</div>
        <div className="flex flex-col gap-1">
          <p className="m-0 text-gray-900">点击或拖拽文件到此处上传</p>
          <p className="m-0 text-xs text-gray-600">支持单个或多个文件</p>
        </div>
      </div>
    </div>
  );
};

export default DragZone;
