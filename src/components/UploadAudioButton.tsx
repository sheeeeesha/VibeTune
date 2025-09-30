"use client";

import React, { useRef } from "react";
import { Upload } from "lucide-react";

interface UploadAudioButtonProps {
  onFileSelected: (file: File) => void;
}

const UploadAudioButton: React.FC<UploadAudioButtonProps> = ({ onFileSelected }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (inputRef.current) inputRef.current.value = ""; // reset for same-file reselect
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm"
        className="hidden"
        onChange={handleChange}
      />
      <button
        onClick={handleClick}
        className="px-4 py-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white text-sm inline-flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        Upload audio
      </button>
    </div>
  );
};

export default UploadAudioButton;
