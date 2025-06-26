"use client";
import React, { useState } from "react";

interface AdminPromoteTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { user_id: number; username: string; email: string } | null;
  onPromote: () => void;
}

export default function AdminPromoteTrainerModal({ isOpen, onClose, user, onPromote }: AdminPromoteTrainerModalProps) {
  const [step, setStep] = useState(1);
  const [specialization, setSpecialization] = useState("");
  const [bio, setBio] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Сброс при открытии
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSpecialization("");
      setBio("");
      setFirstName(user?.username?.split(" ")[0] || "");
      setLastName(user?.username?.split(" ")[1] || "");
      setPhotoUrl("");
      setError(null);
    }
  }, [isOpen, user]);

  const handleNext = () => {
    if (!specialization.trim()) {
      setError("Введите специализацию тренера");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handlePromote = async () => {
    if (!bio.trim() || !firstName.trim() || !lastName.trim()) {
      setError("Заполните все поля");
      return;
    }
    // Если фото выбрано, но url не получен (фото еще не загрузилось или была ошибка)
    if (photoFile && !photoUrl) {
      setError("Дождитесь загрузки фото тренера");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user?.user_id,
          specialization,
          bio,
          first_name: firstName,
          last_name: lastName,
          photo_url: photoUrl,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Ошибка назначения тренера");
        setLoading(false);
        return;
      }
      setLoading(false);
      onPromote();
      onClose();
    } catch (e: any) {
      setError(e.message || "Ошибка сети");
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      const formData = new FormData();
      formData.append('file', file);
      setPhotoUploading(true);
      setError(null);
      try {
        const res = await fetch('/api/upload-trainer-photo', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.url) {
          setPhotoUrl(data.url);
        } else {
          setError(data.message || 'Ошибка загрузки фото');
        }
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки фото');
      }
      setPhotoUploading(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-4">Назначить тренером: {user.username}</h2>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {step === 1 && (
          <>
            <label className="block text-gray-300 mb-2">Специализация</label>
            <input
              className="w-full bg-gray-700 text-white p-2 rounded mb-4"
              value={specialization}
              onChange={e => setSpecialization(e.target.value)}
              placeholder="Например: Фитнес, кроссфит"
              disabled={loading}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold w-full"
              onClick={handleNext}
              disabled={loading}
            >Далее</button>
          </>
        )}
        {step === 2 && (
          <>
            <label className="block text-gray-300 mb-2">Имя</label>
            <input
              className="w-full bg-gray-700 text-white p-2 rounded mb-2"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Имя тренера"
              disabled={loading}
            />
            <label className="block text-gray-300 mb-2">Фамилия</label>
            <input
              className="w-full bg-gray-700 text-white p-2 rounded mb-2"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Фамилия тренера"
              disabled={loading}
            />
            <label className="block text-gray-300 mb-2">Фото тренера</label>
            <input
              type="file"
              accept="image/*"
              className="w-full bg-gray-700 text-white p-2 rounded mb-2"
              onChange={handlePhotoChange}
              disabled={photoUploading || loading}
            />
            {photoUrl && (
              <img src={photoUrl} alt="Фото тренера" className="mb-2 max-h-32 rounded" />
            )}
            <label className="block text-gray-300 mb-2">Биография</label>
            <textarea
              className="w-full bg-gray-700 text-white p-2 rounded mb-4"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Кратко о тренере"
              rows={4}
              disabled={loading}
            />
            <div className="flex gap-2">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-bold flex-1"
                onClick={() => setStep(1)}
                disabled={loading}
              >Назад</button>
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex-1"
                onClick={handlePromote}
                disabled={loading || photoUploading}
              >Подтвердить</button>
            </div>
          </>
        )}
        <button
          className="mt-4 text-gray-400 hover:text-white underline w-full"
          onClick={onClose}
          disabled={loading}
        >Отмена</button>
      </div>
    </div>
  );
} 