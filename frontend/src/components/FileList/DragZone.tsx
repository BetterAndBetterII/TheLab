import React, { useRef, useState } from 'react';
import styles from './DragZone.module.css';

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
      className={`${styles.dragZone} ${isDragging ? styles.dragging : ''}`}
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
      <div className={styles.content}>
        <div className={styles.icon}>📤</div>
        <div className={styles.text}>
          <p>点击或拖拽文件到此处上传</p>
          <p className={styles.hint}>支持单个或多个文件</p>
        </div>
      </div>
    </div>
  );
};

export default DragZone;
