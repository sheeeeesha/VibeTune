'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X, Music, Sliders, Scissors } from 'lucide-react';
import { AudioClip } from '@/types';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  selectedClip: AudioClip | null;
}

const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedClip,
}) => {
  const router = useRouter();

  const handleEditOption = (option: 'chops' | 'notes' | 'fx') => {
    if (!selectedClip) {
      console.error('EditModal - No selected clip to edit');
      return;
    }
    
    console.log('EditModal - Storing clip for edit:', selectedClip);
    
    // Store clip data for the edit page using a different key to avoid interference
    localStorage.setItem('currentEditingClip', JSON.stringify(selectedClip));
    
    // Verify it was stored
    const stored = localStorage.getItem('currentEditingClip');
    console.log('EditModal - Stored clip data:', stored);
    
    // Navigate to the appropriate edit page with a small delay to ensure localStorage is set
    setTimeout(() => {
      router.push(`/edit/${option}`);
    }, 50);
    
    // Close the modal
    onClose();
  };

  if (!isOpen || !selectedClip) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-white text-lg font-medium">Edit Track</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Waveform Display */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative h-24 bg-gray-800 rounded-lg overflow-hidden">
            {/* Simplified waveform for modal */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-end justify-center h-16 gap-px">
                {Array.from({ length: 50 }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-sm"
                    style={{
                      width: '2px',
                      height: `${Math.random() * 20 + 4}px`,
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500" style={{ left: '30%' }} />
            
            {/* Play/Pause button */}
            <button className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/50 rounded-full p-2">
                <div className="w-6 h-6 bg-white rounded-sm ml-0.5"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Edit Options */}
        <div className="p-6">
          <h3 className="text-white font-medium mb-6 text-center">Choose Edit Mode</h3>
          
          <div className="space-y-4">
            <button
              onClick={() => handleEditOption('chops')}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <Scissors className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white font-medium">Chops</div>
                <div className="text-gray-400 text-sm">Slice and dice your audio</div>
              </div>
            </button>

            <button
              onClick={() => handleEditOption('notes')}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white font-medium">Notes</div>
                <div className="text-gray-400 text-sm">Key detection and transposition</div>
              </div>
            </button>

            <button
              onClick={() => handleEditOption('fx')}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                <Sliders className="w-6 h-6 text-white" />
              </div>
              <div className="text-left">
                <div className="text-white font-medium">FX</div>
                <div className="text-gray-400 text-sm">Audio effects and processing</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <div className="text-gray-400 text-sm">
            Select an option above
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
