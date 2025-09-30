'use client';

import React from 'react';
import { MusicalElement } from '@/types';

interface ElementSelectorProps {
  elements: MusicalElement[];
  onElementSelect: (elementId: string) => void;
}

const ElementSelector: React.FC<ElementSelectorProps> = ({
  elements,
  onElementSelect,
}) => {
  return (
    <div className="px-4 py-6">
      <div className="grid grid-cols-2 gap-3">
        {elements.map((element) => (
          <button
            key={element.id}
            onClick={() => onElementSelect(element.id)}
            className={`
              px-4 py-3 rounded-full text-sm font-medium transition-all duration-200
              ${element.isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'bg-transparent text-white border border-gray-600 hover:border-gray-500'
              }
            `}
          >
            {element.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ElementSelector;
