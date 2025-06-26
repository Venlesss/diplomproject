"use client";

import Link from 'next/link';
import { NavButtons } from './components/NavButtons';
import { useEffect, useState, useRef } from 'react';
import TrainerCard from './components/TrainerCard';
import { useRouter } from 'next/navigation';
import format from 'date-fns/format';
import { ru } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';

interface Trainer {
  trainer_id: number;
  first_name: string;
  last_name: string;
  specialization: string;
  bio: string;
  photo_url: string;
}

interface PriceItem {
  price_id: number;
  name: string;
  price: string;
  description: string;
}

interface GalleryImage {
  image_id: number;
  image_url: string;
  description: string;
}

type NewsItem = {
  news_id: number;
  title: string;
  content: string;
  date: string;
};

export default function Home() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editedPrices, setEditedPrices] = useState<PriceItem[]>([]);
  const [editedTrainers, setEditedTrainers] = useState<Trainer[]>([]);
  const router = useRouter();
  const [isAuth, setIsAuth] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const bioRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [newGalleryImages, setNewGalleryImages] = useState<{ file: File, preview: string, description: string }[]>([]);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [editedNews, setEditedNews] = useState<NewsItem[]>([]);
  const [newNews, setNewNews] = useState<{ title: string; content: string }>({ title: '', content: '' });
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trainersRes, pricesRes] = await Promise.all([
          fetch('/api/trainers/list'),
          fetch('/api/pricelist')
        ]);
        
        if (!trainersRes.ok || !pricesRes.ok) {
          throw new Error('Ошибка загрузки данных');
        }
        
        const trainersData = await trainersRes.json();
        const pricesData = await pricesRes.json();
        
        setTrainers(trainersData);
        setPrices(pricesData);
        setEditedTrainers(trainersData);
        setEditedPrices(pricesData);
      } catch (error) {
        console.error('Ошибка:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    // Проверяем режим редактирования
    const isEdit = localStorage.getItem('editMain') === '1';
    const role = localStorage.getItem('role');
    setEditMode(isEdit && role === '1');

    // Проверка авторизации
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const roleVal = localStorage.getItem('role');
    setIsAuth(!!token && !!userId);
    setUserId(userId);
    setRole(roleVal);

    // Загрузка новостей
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) throw new Error('Ошибка загрузки новостей');
        const data = await res.json();
        setNews(data);
        setEditedNews(data);
      } catch (e) {
        setNews([]);
        setEditedNews([]);
      }
    };
    fetchNews();
  }, []);

  useEffect(() => {
    if (editMode) {
      editedTrainers.forEach((trainer, idx) => {
        const ref = bioRefs.current[idx];
        if (ref) {
          ref.style.height = 'auto';
          ref.style.height = ref.scrollHeight + 'px';
        }
      });
    }
  }, [editMode, editedTrainers]);

  useEffect(() => {
    const fetchGallery = async () => {
      setGalleryLoading(true);
      try {
        const res = await fetch('/api/gallery');
        const data = await res.json();
        setGallery(data);
      } catch {
        setGallery([]);
      } finally {
        setGalleryLoading(false);
      }
    };
    fetchGallery();
  }, [editMode]);

  const handlePriceChange = (index: number, field: keyof PriceItem, value: string) => {
    setEditedPrices(prices => prices.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const handleTrainerChange = (index: number, field: keyof Trainer, value: string) => {
    setEditedTrainers(trs => trs.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };
  const handlePhotoChange = async (index: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload-trainer-photo', {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      setEditedTrainers(trs => trs.map((item, i) => i === index ? { ...item, photo_url: data.url } : item));
    } else {
      alert('Ошибка загрузки фото');
    }
  };
  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setNewGalleryImages(arr => [{ file, preview, description: '' }, ...arr]);
      // Сброс input чтобы можно было выбрать тот же файл снова
      e.target.value = '';
    }
  };
  const handleNewGalleryDescChange = (index: number, value: string) => {
    setNewGalleryImages(arr => arr.map((img, i) => i === index ? { ...img, description: value } : img));
  };
  const handleRemoveNewGalleryImage = (index: number) => {
    setNewGalleryImages(arr => arr.filter((_, i) => i !== index));
  };
  const handleSave = async () => {
    const token = localStorage.getItem('token');
    // Сохраняем прайс-лист
    await fetch('/api/pricelist', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(editedPrices)
    });
    // Сохраняем тренеров
    await fetch('/api/trainers', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(editedTrainers)
    });
    // Сохраняем новые фото галереи
    for (const img of newGalleryImages) {
      const formData = new FormData();
      formData.append('file', img.file);
      formData.append('description', img.description);
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
    }
    setNewGalleryImages([]);
    localStorage.removeItem('editMain');
    router.push(`/profile/${localStorage.getItem('userId')}`);
  };

  const handleGalleryDescriptionChange = (index: number, value: string) => {
    setGallery(gal => gal.map((img, i) => i === index ? { ...img, description: value } : img));
  };
  const handleGalleryDescriptionSave = async (img: GalleryImage) => {
    const formData = new FormData();
    formData.append('image_id', img.image_id.toString());
    formData.append('description', img.description || '');
    await fetch('/api/gallery', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
  };
  const handleGalleryPhotoChange = async (index: number, file: File) => {
    const img = gallery[index];
    const formData = new FormData();
    formData.append('image_id', img.image_id.toString());
    formData.append('description', img.description || '');
    formData.append('file', file);
    const res = await fetch('/api/gallery', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      setGallery(gal => gal.map((item, i) => i === index ? { ...item, image_url: data.url } : item));
    } else {
      alert('Ошибка загрузки фото');
    }
  };
  const handleGalleryDelete = async (image_id: number) => {
    if (!confirm('Удалить это фото?')) return;
    await fetch(`/api/gallery?image_id=${image_id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    setGallery(gal => gal.filter(img => img.image_id !== image_id));
  };

  const handleNewsInputChange = (field: keyof typeof newNews, value: string) => {
    setNewNews(prev => ({ ...prev, [field]: value }));
  };

  const handleAddNews = async () => {
    if (!newNews.title.trim() || !newNews.content.trim()) return;
    setNewsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newNews.title,
          content: newNews.content
        })
      });
      if (res.ok) {
        setNewNews({ title: '', content: '' });
        // Обновить список новостей
        const updated = await fetch('/api/news').then(r => r.json());
        setNews(updated);
        setEditedNews(updated);
      }
    } finally {
      setNewsLoading(false);
    }
  };

  const handleDeleteNews = async (news_id: number) => {
    if (!window.confirm('Удалить эту новость?')) return;
    setNewsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/news?id=${news_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setEditedNews(editedNews.filter(n => n.news_id !== news_id));
        setNews(news.filter(n => n.news_id !== news_id));
      }
    } finally {
      setNewsLoading(false);
    }
  };

  const formatNewsDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    // Используем toLocaleDateString для корректного форматирования на русском
    let formatted = date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    formatted = formatted.replace(
      /\s([а-яё]+)/i,
      (match) => ' ' + match.trim().charAt(0).toUpperCase() + match.trim().slice(1)
    );
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();
    let ago = '';
    if (isToday) {
      ago = 'сегодня';
    } else if (isYesterday) {
      ago = 'вчера';
    } else {
      ago = formatDistanceToNow(date, { locale: ru, addSuffix: true });
    }
    return `${formatted} (${ago})`;
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Навбар */}
      <nav className="bg-gray-800 p-4 fixed w-full z-10">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-white text-xl font-bold">
            Звёздный фитнес
          </Link>
          <NavButtons />
          {isAuth && userId && role ? (
            <Link
              href={role === '1' ? `/profile/${userId}` : `/user/${userId}`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-300"
            >
              Личный кабинет
            </Link>
          ) : (
            <Link
              href="/auth"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-300"
            >
              Вход/Регистрация
            </Link>
          )}
        </div>
      </nav>

      {/* Основной контент */}
      <div className="pt-20">
        {/* Герой-секция */}
        <section className="container mx-auto px-4 py-32" id="about">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-6 animate-fade-in">
              Добро пожаловать в Звёздный фитнес
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Премиальный тренажерный зал с профессиональным оборудованием и лучшими тренерами города
            </p>
          </div>

          {/* Преимущества */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-gray-800 p-6 rounded-lg hover:transform hover:scale-105 transition">
              <h3 className="text-2xl font-bold text-white mb-4">🏋️ Современное оборудование</h3>
              <p className="text-gray-400">Тренажеры последнего поколения от мировых производителей</p>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg hover:transform hover:scale-105 transition">
              <h3 className="text-2xl font-bold text-white mb-4">👥 Профессиональные тренеры</h3>
              <p className="text-gray-400">Опытные специалисты с индивидуальным подходом</p>
            </div>
            
            <div className="bg-gray-800 p-6 rounded-lg hover:transform hover:scale-105 transition">
              <h3 className="text-2xl font-bold text-white mb-4">⏱️ Гибкое расписание</h3>
              <p className="text-gray-400">Работаем 24/7 для вашего удобства</p>
            </div>
          </div>
        </section>

        {/* Тренеры */}
        <section className="container mx-auto px-4 py-16" id="trainers">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Наши тренеры</h2>
          {isLoading ? (
            <div className="text-center text-white">Загрузка тренеров...</div>
          ) : editMode ? (
            <div className="overflow-x-auto rounded-lg border border-gray-600 mb-12">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Имя</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Фамилия</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Специализация</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Биография</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Фото (URL)</th>
                  </tr>
                </thead>
                <tbody>
                  {editedTrainers.map((trainer, index) => (
                    <tr key={trainer.trainer_id} className="border-b border-gray-600 hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 text-gray-300">{trainer.first_name}</td>
                      <td className="px-6 py-4 text-gray-300">{trainer.last_name}</td>
                      <td className="px-6 py-4 text-gray-300">
                        <input className="bg-gray-700 text-white rounded px-2 py-1 w-full" value={trainer.specialization} onChange={e => handleTrainerChange(index, 'specialization', e.target.value)} />
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        <textarea
                          ref={el => { bioRefs.current[index] = el; }}
                          className="bg-gray-700 text-white rounded px-2 py-1 w-full resize-none"
                          value={trainer.bio}
                          onChange={e => {
                            handleTrainerChange(index, 'bio', e.target.value);
                            const ta = e.target as HTMLTextAreaElement;
                            ta.style.height = 'auto';
                            ta.style.height = ta.scrollHeight + 'px';
                          }}
                          rows={1}
                          style={{ minHeight: 40, overflow: 'hidden' }}
                        />
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        <div className="flex flex-col gap-2">
                          {trainer.photo_url && (
                            <img src={trainer.photo_url} alt="Фото" className="mb-2 rounded w-24 h-24 object-cover border border-gray-600" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              if (e.target.files && e.target.files[0]) {
                                handlePhotoChange(index, e.target.files[0]);
                              }
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {trainers.map((trainer) => (
                <TrainerCard key={trainer.trainer_id} trainer={trainer} />
              ))}
            </div>
          )}
        </section>

        {/* Прайс-лист */}
        <section className="bg-gray-800 py-16" id="prices">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-white mb-12 text-center">Наши тарифы</h2>
            
            <div className="overflow-x-auto rounded-lg border border-gray-600">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Услуга</th>
                    <th className="px-6 py-4 text-left text-white font-bold text-lg">Описание</th>
                    <th className="px-6 py-4 text-right text-white font-bold text-lg">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {(editMode ? editedPrices : prices).map((item, index) => (
                    <tr 
                      key={index}
                      className="border-b border-gray-600 hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4 text-gray-300">
                        {editMode ? (
                          <input className="bg-gray-700 text-white rounded px-2 py-1 w-full" value={item.name} onChange={e => handlePriceChange(index, 'name', e.target.value)} />
                        ) : item.name}
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        {editMode ? (
                          <input className="bg-gray-700 text-white rounded px-2 py-1 w-full" value={item.description} onChange={e => handlePriceChange(index, 'description', e.target.value)} />
                        ) : item.description}
                      </td>
                      <td className="px-6 py-4 text-right text-blue-400 font-medium">
                        {editMode ? (
                          <input className="bg-gray-700 text-white rounded px-2 py-1 w-full text-right" value={item.price} onChange={e => handlePriceChange(index, 'price', e.target.value)} />
                        ) : item.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-gray-400 text-sm mt-4">
              * В стоимость всех абонементов входит бесплатный доступ к раздевалкам и душевым
            </p>
          </div>
        </section>

        {/* Галерея */}
        <section className="container mx-auto px-4 py-16" id="gallery">
          <h2 className="text-4xl font-bold text-white mb-12 text-center">Наша галерея</h2>
          {galleryLoading ? (
            <div className="text-center text-white">Загрузка...</div>
          ) : editMode ? (
            <div>
              <button
                className="mb-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
                onClick={() => galleryFileInputRef.current?.click()}
              >
                Добавить фото
              </button>
              <input
                type="file"
                ref={galleryFileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleGalleryFileSelect}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {newGalleryImages.map((img, index) => (
                  <div key={img.preview} className="relative bg-gray-700 rounded-lg overflow-hidden flex flex-col items-center p-2 border-2 border-blue-400">
                    <img src={img.preview} alt="Preview" className="rounded-lg h-64 object-cover w-full mb-2" />
                    <input
                      className="bg-gray-800 text-white rounded px-2 py-1 w-full mb-2"
                      value={img.description}
                      onChange={e => handleNewGalleryDescChange(index, e.target.value)}
                      placeholder="Описание (необязательно)"
                    />
                    <button className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded" onClick={() => handleRemoveNewGalleryImage(index)}>Удалить</button>
                  </div>
                ))}
                {gallery.map((img, index) => (
                  <div key={img.image_id} className="relative bg-gray-700 rounded-lg overflow-hidden flex flex-col items-center p-2">
                    <img src={img.image_url} alt="Gallery" className="rounded-lg h-64 object-cover w-full mb-2" />
                    <input
                      className="bg-gray-800 text-white rounded px-2 py-1 w-full mb-2"
                      value={img.description || ''}
                      onChange={e => handleGalleryDescriptionChange(index, e.target.value)}
                      onBlur={() => handleGalleryDescriptionSave(img)}
                      placeholder="Описание (необязательно)"
                    />
                    <button className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded" onClick={() => handleGalleryDelete(img.image_id)}>Удалить</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {gallery.map((img) => (
                <div key={img.image_id} className="flex flex-col items-center bg-gray-800 rounded-2xl overflow-hidden shadow-lg p-4 m-2">
                  <img
                    src={img.image_url}
                    alt={img.description || 'Gallery'}
                    className="rounded-lg h-64 object-cover w-full"
                    title={img.description || ''}
                  />
                  {img.description && (
                    <div className="text-white text-lg font-semibold py-2 text-center w-full">
                      {img.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Новости */}
        <section className="bg-gray-800 py-16" id="news">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-white mb-12 text-center">Последние новости</h2>
            {editMode ? (
              <div>
                <div className="mb-8 bg-gray-700 p-6 rounded-lg">
                  <h3 className="text-xl text-white font-bold mb-4">Добавить новость</h3>
                  <input
                    className="w-full bg-gray-800 text-white p-2 rounded mb-2"
                    placeholder="Заголовок"
                    value={newNews.title}
                    onChange={e => handleNewsInputChange('title', e.target.value)}
                    disabled={newsLoading}
                  />
                  <textarea
                    className="w-full bg-gray-800 text-white p-2 rounded mb-2"
                    placeholder="Текст новости"
                    value={newNews.content}
                    onChange={e => handleNewsInputChange('content', e.target.value)}
                    rows={3}
                    disabled={newsLoading}
                  />
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold mt-2"
                    onClick={handleAddNews}
                    disabled={newsLoading || !newNews.title.trim() || !newNews.content.trim()}
                  >Добавить</button>
                </div>
                <div className="grid md:grid-cols-2 gap-8">
                  {editedNews.length === 0 ? (
                    <div className="text-white">Нет новостей</div>
                  ) : (
                    editedNews.map((newsItem, index) => (
                      <div key={newsItem.news_id || index} className="bg-gray-700 p-6 rounded-lg relative">
                        <button
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                          onClick={() => handleDeleteNews(newsItem.news_id)}
                          disabled={newsLoading}
                          title="Удалить новость"
                        >✕</button>
                        <h3 className="text-2xl font-bold text-white mb-3">{newsItem.title}</h3>
                        <p className="text-gray-300 mb-4">{newsItem.content}</p>
                        <span className="text-blue-400 text-sm">{formatNewsDate(newsItem.date)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {news.length === 0 ? (
                  <div className="text-white">Нет новостей</div>
                ) : (
                  news.map((newsItem, index) => (
                    <div key={newsItem.news_id || index} className="bg-gray-700 p-6 rounded-lg">
                      <h3 className="text-2xl font-bold text-white mb-3">{newsItem.title}</h3>
                      <p className="text-gray-300 mb-4">{newsItem.content}</p>
                      <span className="text-blue-400 text-sm">{formatNewsDate(newsItem.date)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

        {/* Подвал */}
        <footer className="bg-gray-800 py-12 mt-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Контакты</h3>
                <p className="text-gray-300">г. Гродно, ул. Замковая, 21</p>
                <p className="text-gray-300 mt-2">+375 (29) 123-45-67</p>
                <p className="text-gray-300 mt-2">info@звёздный-фитнес.by</p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-4">График работы</h3>
                <p className="text-gray-300">Пн-Пт: 7:00 - 23:00</p>
                <p className="text-gray-300 mt-2">Сб-Вс: 8:00 - 22:00</p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-4">Мы в соцсетях</h3>
                <div className="flex gap-4">
                  {[
                    { name: 'YouTube', icon: '▶', link: 'https://youtube.com' },
                    { name: 'VK', icon: 'VK', link: 'https://vk.com' },
                    { name: 'Instagram', icon: '📸', link: 'https://instagram.com' }
                  ].map((social, index) => (
                    <a
                      key={index}
                      href={social.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-700 p-3 rounded-full hover:bg-blue-600 transition"
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-4">Звёздный фитнес</h3>
                <p className="text-gray-300">
                  Лучший фитнес-клуб Гродно с 2025 года. 
                  Профессиональные тренеры и современное оборудование.
                </p>
              </div>
            </div>
            
            <div className="border-t border-gray-700 mt-8 pt-8 text-center">
              <p className="text-gray-400">© 2025 Звёздный фитнес. Все права защищены</p>
            </div>
          </div>
        </footer>
      </div>
      {editMode && (
        <div className="w-full flex justify-center py-10 bg-gray-900">
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-10 py-4 rounded-2xl font-bold text-xl shadow-lg border-4 border-green-700"
            onClick={handleSave}
          >
            Применить изменения
          </button>
        </div>
      )}
    </div>
  );
}