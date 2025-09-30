'use client';

import React, { useState } from 'react';
import { Genre } from '@/types';

interface GenreSelectorProps {
  genres: Genre[];
  onGenreSelect: (genreId: string) => void;
  onAddCustomGenre?: (label: string) => void;
}

const GenreSelector: React.FC<GenreSelectorProps> = ({
  genres,
  onGenreSelect,
  onAddCustomGenre,
}) => {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (!value.trim()) return;
    onAddCustomGenre?.(value.trim());
    setValue('');
    setAdding(false);
  };

  return (
    <div className="px-4 py-2">
      <div className="grid grid-cols-4 gap-3">
        {genres.map((genre) => (
          <button
            key={genre.id}
            onClick={() => onGenreSelect(genre.id)}
            className={`
              px-3 py-3 rounded-full text-sm font-medium transition-all duration-200
              ${genre.isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'bg-transparent text-white border border-gray-600 hover:border-gray-500'
              }
            `}
          >
            {genre.label}
          </button>
        ))}
      </div>

      {/* Add custom genre row */}
      <div className="mt-3">
        {adding ? (
          <div className="flex items-center gap-2 max-w-sm">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="type genre"
              className="flex-1 px-3 py-2 rounded-full bg-transparent text-white border border-gray-600 outline-none placeholder-gray-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setValue(''); setAdding(false); }
              }}
            />
            <button
              onClick={handleAdd}
              className="px-3 py-2 rounded-full bg-white text-gray-900 text-sm font-medium"
            >
              Add
            </button>
            <button
              onClick={() => { setValue(''); setAdding(false); }}
              className="px-3 py-2 rounded-full bg-gray-800 text-white text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 rounded-full bg-transparent text-white border border-gray-600 hover:border-gray-500 text-sm"
            aria-label="Add custom genre"
          >
            + Add genre
          </button>
        )}
      </div>
    </div>
  );
};

export default GenreSelector;
