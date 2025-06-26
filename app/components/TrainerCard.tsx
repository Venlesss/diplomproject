"use client";

import Image from 'next/image';
import React, { useState } from 'react';

interface Trainer {
  trainer_id: number;
  first_name: string;
  last_name: string;
  specialization: string;
  bio: string;
  photo_url: string;
}

export default function TrainerCard({ trainer }: { trainer: Trainer }) {
    // Добавляем проверку на неполные данные
    if (!trainer || !trainer.first_name) return null;
  
    const [expanded, setExpanded] = useState(false);
    const maxLength = 120;
    const isLong = trainer.bio.length > maxLength;
    const displayBio = expanded || !isLong ? trainer.bio : trainer.bio.slice(0, maxLength) + '...';

    return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden hover:transform hover:scale-102 transition duration-300">
      <div className="p-6">
        <div className="relative h-48 w-full mb-4">
          {trainer.photo_url ? (
            <Image
              src={trainer.photo_url}
              alt={`${trainer.first_name} ${trainer.last_name}`}
              fill
              className="object-cover rounded-lg"
              sizes="(max-width: 768px) 100vw, 300px"
            />
          ) : (
            <div className="h-full w-full bg-gray-700 flex items-center justify-center text-gray-400 rounded-lg">
              Фото отсутствует
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {trainer.first_name} {trainer.last_name}
        </h2>
        <p className="text-lg text-blue-400 mb-3">{trainer.specialization}</p>
        <p className="text-gray-300 mb-2">{displayBio}</p>
        {isLong && (
          <button
            className="text-blue-400 hover:text-blue-600 underline text-sm"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Свернуть' : 'Развернуть'}
          </button>
        )}
      </div>
    </div>
  );
}