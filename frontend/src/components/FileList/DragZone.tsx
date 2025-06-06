import React, { useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Upload } from 'lucide-react';

interface DragZoneProps {
  onFilesDrop: (files: FileList) => void;
  multiple?: boolean;
  accept?: string;
}

const DragZone: React.FC<DragZoneProps> = ({
  onFilesDrop,
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
      onFilesDrop(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFilesDrop(files);
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center bg-gray-50 cursor-pointer transition-all",
        isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-500 hover:bg-gray-100"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInput}
        multiple={multiple}
        accept={accept}
      />
      <div className="flex flex-col items-center gap-4">
        <div className="text-blue-500">
          <Upload size={32} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-gray-900 m-0">点击或拖拽文件到此处上传</p>
          <p className="text-xs text-gray-600 m-0">支持单个或多个文件</p>
        </div>
      </div>
    </div>
  );
};

export default DragZone;

