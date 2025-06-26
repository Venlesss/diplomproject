"use client";

import { useCallback } from 'react';

export const NavButtons = () => {
  const scrollToSection = useCallback((sectionId: string) => {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="flex gap-4 bg-gray-700 bg-opacity-80 rounded-full px-4 py-2 shadow-lg">
      <button 
        onClick={() => scrollToSection('about')}
        className="text-white font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        О нас
      </button>
      <button
        onClick={() => scrollToSection('trainers')}
        className="text-white font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Тренеры
      </button>
      <button
        onClick={() => scrollToSection('prices')}
        className="text-white font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Цены
      </button>
      <button
        onClick={() => scrollToSection('gallery')}
        className="text-white font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Галерея
      </button>
      <button
        onClick={() => scrollToSection('news')}
        className="text-white font-semibold px-4 py-2 rounded-full transition-all duration-200 hover:bg-blue-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        Новости
      </button>
    </div>
  );
};