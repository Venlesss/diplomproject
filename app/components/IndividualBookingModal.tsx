"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datepicker-custom.css';
import { ru as ruLocale } from 'date-fns/locale';
import { registerLocale } from 'react-datepicker';

interface Trainer {
  trainer_id: number;
  first_name: string;
  last_name: string;
}

interface IndividualBookingBlockProps {
  visible: boolean;
  onClose?: () => void;
}

registerLocale('ru', ruLocale);

export default function IndividualBookingBlock({ visible, onClose }: IndividualBookingBlockProps) {
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState<string>("");
  const [bookingTime, setBookingTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minDate, setMinDate] = useState<string>("");
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const [show, setShow] = useState(visible);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [daysOff, setDaysOff] = useState<{ type: 'off' | 'vacation'; date: string | null; start_date: string | null; end_date: string | null }[]>([]);
  const [disabledDates, setDisabledDates] = useState<Date[]>([]);

  // Генерируем доступные временные слоты
  const timeSlots = useMemo(() => {
    if (!bookingDate) return [];
    
    const date = new Date(bookingDate);
    const dayOfWeek = date.getDay(); // 0 - воскресенье, 6 - суббота
    
    const slots = [];
    
    // Будние дни (пн-пт)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      for (let hour = 7; hour <= 21; hour += 2) {
        slots.push(`${hour.toString().padStart(2, '0')}:00 - ${(hour + 2).toString().padStart(2, '0')}:00`);
      }
    } 
    // Выходные дни (сб-вс)
    else {
      for (let hour = 8; hour <= 20; hour += 2) {
        slots.push(`${hour.toString().padStart(2, '0')}:00 - ${(hour + 2).toString().padStart(2, '0')}:00`);
      }
    }
    
    return slots;
  }, [bookingDate]);

  useEffect(() => {
    // Устанавливаем минимальную дату как сегодня
    const updateMinDate = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setMinDate(today.toISOString().split('T')[0]);
    };
    updateMinDate();
    // Сбрасываем состояние при открытии блока
    if (visible) {
      setSelectedSpecialization("");
      setSelectedTrainerId(null);
      setBookingDate("");
      setBookingTime("");
      setError(null);
    }
  }, [visible]);

  // Следим за сменой дня, чтобы minDate всегда был актуальным
  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      if (minDate !== todayStr) {
        setMinDate(todayStr);
      }
    }, 60 * 1000); // Проверяем каждую минуту
    return () => clearInterval(interval);
  }, [minDate]);

  useEffect(() => {
    if (!visible) return;

    const fetchSpecializations = async () => {
      try {
        const response = await fetch('/api/trainers/specializations');
        if (!response.ok) throw new Error('Не удалось загрузить специализации');
        const data = await response.json();
        setSpecializations(data);
      } catch (err) {
        console.error('Ошибка загрузки специализаций:', err);
        setError('Ошибка загрузки специализаций');
      }
    };

    fetchSpecializations();
  }, [visible]);

  useEffect(() => {
    if (!selectedSpecialization) return;

    const fetchTrainersBySpecialization = async () => {
      try {
        const response = await fetch(`/api/trainers/list?specialization=${encodeURIComponent(selectedSpecialization)}`);
        if (!response.ok) throw new Error('Не удалось загрузить тренеров');
        const data = await response.json();
        setTrainers(data);
      } catch (err) {
        console.error('Ошибка загрузки тренеров:', err);
        setError('Ошибка загрузки тренеров');
      }
    };

    fetchTrainersBySpecialization();
  }, [selectedSpecialization]);

  // Загружаем занятые слоты при изменении специализации и даты
  useEffect(() => {
    const fetchBusySlots = async () => {
      setBusySlots([]);
      if (!selectedSpecialization || !bookingDate) return;
      try {
        const response = await fetch(`/api/busy-individual-slots?specialization=${encodeURIComponent(selectedSpecialization)}&date=${bookingDate}`);
        if (!response.ok) throw new Error('Ошибка загрузки занятых слотов');
        const data = await response.json();
        setBusySlots(data.busySlots || []);
      } catch (err) {
        setBusySlots([]);
      }
    };
    fetchBusySlots();
  }, [selectedSpecialization, bookingDate]);

  useEffect(() => {
    if (visible) {
      setShow(true);
    } else {
      timeoutRef.current = setTimeout(() => setShow(false), 300);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible]);

  // Загружаем выходные и отпуска тренера при выборе тренера
  useEffect(() => {
    if (!selectedTrainerId) {
      setDaysOff([]);
      setDisabledDates([]);
      return;
    }
    fetch(`/api/trainers/${selectedTrainerId}/days-off`)
      .then(res => res.json())
      .then(data => {
        setDaysOff(data);
        // Формируем массив disabled дат для календаря
        const result: Date[] = [];
        data.forEach((item: { type: string; date?: string; start_date?: string; end_date?: string }) => {
          if (item.type === 'off' && item.date) {
            result.push(new Date(item.date));
          } else if (item.type === 'vacation' && item.start_date && item.end_date) {
            let d = new Date(item.start_date);
            const end = new Date(item.end_date);
            while (d <= end) {
              result.push(new Date(d));
              d.setDate(d.getDate() + 1);
            }
          }
        });
        setDisabledDates(result);
      })
      .catch(() => {
        setDaysOff([]);
        setDisabledDates([]);
      });
  }, [selectedTrainerId]);

  function isDateDisabled(dateStr: string) {
    for (const d of disabledDates) {
      if (dateStr === d.toISOString().split('T')[0]) return true;
    }
    return false;
  }

  const handleSubmit = async () => {
    if (!selectedSpecialization || !selectedTrainerId || !bookingDate || !bookingTime) {
      setError("Пожалуйста, заполните все поля");
      return;
    }
    
    // Проверка что выбрана сегодняшняя или будущая дата
    const selectedDate = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setError("Нельзя выбрать прошедшую дату");
      return;
    }
    
    // Формируем дату и время бронирования
    const [startTime] = bookingTime.split(' - ');
    const bookingDateTime = `${bookingDate}T${startTime}:00`;

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Ошибка авторизации. Пожалуйста, войдите заново.");
        setIsLoading(false);
        return;
      }
      const response = await fetch('/api/individual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          trainerId: selectedTrainerId,
          specialization: selectedSpecialization,
          bookingDateTime
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Ошибка при создании бронирования');
        setIsLoading(false);
        return;
      }
      alert("Индивидуальное занятие успешно забронировано!");
      if (onClose) {
        onClose();
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Произошла ошибка");
    } finally {
      setIsLoading(false);
    }
  };

  // Формируем опции для react-select
  const timeOptions = timeSlots.map((slot) => {
    const [start] = slot.split(' - ');
    const isBusy = busySlots.includes(start);
    return {
      value: slot,
      label: (
        <span style={{ color: isBusy ? '#aaa' : undefined, display: 'flex', alignItems: 'center', gap: 8 }}>
          {slot} {isBusy && <span style={{ color: '#e57373', fontWeight: 500 }}>Занято</span>}
        </span>
      ),
      isDisabled: isBusy,
    };
  });

  // Блок всегда в DOM, но скрывается через стили
  return (
    <div
      className={`bg-gray-800 rounded-2xl p-6 w-full border border-gray-600 shadow-lg
        transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      style={{ willChange: 'opacity, transform', minHeight: show ? 0 : undefined }}
    >
      <h2 className="text-2xl font-bold text-white mb-4">Индивидуальная запись</h2>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="space-y-4">
        <div>
          <label className="block text-gray-300 mb-2">Услуга</label>
          <select
            className="w-full bg-gray-700 text-white p-2 rounded"
            value={selectedSpecialization}
            onChange={(e) => setSelectedSpecialization(e.target.value)}
          >
            <option value="">Выберите услугу</option>
            {specializations.map((spec, index) => (
              <option key={index} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-300 mb-2">Тренер</label>
          <select
            className="w-full bg-gray-700 text-white p-2 rounded"
            value={selectedTrainerId || ""}
            onChange={(e) => setSelectedTrainerId(Number(e.target.value))}
            disabled={!selectedSpecialization}
          >
            <option value="">Выберите тренера</option>
            {trainers.map((trainer) => (
              <option key={trainer.trainer_id} value={trainer.trainer_id}>
                {trainer.first_name} {trainer.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-gray-300 mb-2">Дата</label>
          <DatePicker
            selected={bookingDate ? new Date(bookingDate) : null}
            onChange={date => {
              if (!date) return;
              // Формируем дату в формате YYYY-MM-DD в локальном времени
              const year = date.getFullYear();
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const day = date.getDate().toString().padStart(2, '0');
              const iso = `${year}-${month}-${day}`;
              setBookingDate(iso);
              setBookingTime("");
            }}
            minDate={new Date(minDate)}
            filterDate={date => {
              // disable прошедшие и недоступные даты
              const today = new Date();
              today.setHours(0,0,0,0);
              if (date < today) return false;
              for (const d of disabledDates) {
                if (date.toDateString() === d.toDateString()) return false;
              }
              return true;
            }}
            disabled={!selectedTrainerId}
            dateFormat="dd.MM.yyyy"
            className="custom-datepicker-input"
            calendarClassName="custom-datepicker-calendar"
            placeholderText="Выберите дату"
            locale="ru"
          />
          {bookingDate && isDateDisabled(bookingDate) && (
            <div className="text-red-500 text-sm mt-1">В этот день тренер недоступен для индивидуальных занятий</div>
          )}
        </div>

        {bookingDate && (
          <div>
            <label className="block text-gray-300 mb-2">Время</label>
            <Select
              classNamePrefix="react-select"
              options={timeOptions}
              value={timeOptions.find(opt => opt.value === bookingTime && !opt.isDisabled) || null}
              onChange={opt => setBookingTime(opt && !opt.isDisabled ? opt.value : "")}
              isOptionDisabled={opt => opt.isDisabled}
              placeholder="Выберите время занятия"
              formatOptionLabel={(option: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, color: option.isDisabled ? '#aaa' : '#2563eb' }}>🕒</span>
                  <span style={{ fontWeight: option.isDisabled ? 400 : 600, color: option.isDisabled ? '#aaa' : '#fff' }}>{option.value}</span>
                  {option.isDisabled ? (
                    <span style={{ color: '#e57373', fontWeight: 500, marginLeft: 8 }}>Занято</span>
                  ) : null}
                </div>
              )}
              styles={{
                option: (provided, state) => ({
                  ...provided,
                  color: state.isDisabled ? '#aaa' : '#fff',
                  backgroundColor: state.isDisabled ? '#222' : (state.isSelected ? '#2563eb' : (state.isFocused ? '#374151' : '#1f2937')),
                  cursor: state.isDisabled ? 'not-allowed' : 'pointer',
                  fontSize: 18,
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid #374151',
                  paddingLeft: 18,
                }),
                singleValue: (provided) => ({ ...provided, color: '#fff', fontSize: 18, fontWeight: 600 }),
                control: (provided) => ({ ...provided, backgroundColor: '#374151', minHeight: 48, borderRadius: 12, border: 'none', boxShadow: '0 2px 8px 0 rgba(59,130,246,0.10)' }),
                menu: (provided) => ({ ...provided, backgroundColor: '#1f2937', borderRadius: 12, marginTop: 4, boxShadow: '0 8px 32px 0 rgba(59,130,246,0.18)' }),
                placeholder: (provided) => ({ ...provided, color: '#9ca3af', fontSize: 16 }),
                dropdownIndicator: (provided) => ({ ...provided, color: '#2563eb' }),
                indicatorSeparator: (provided) => ({ ...provided, backgroundColor: '#374151' }),
              }}
              isClearable
            />
            <p className="text-xs text-gray-400 mt-1">
              {timeSlots.length > 0 
                ? "Выберите доступный временной слот" 
                : "На выбранную дату нет доступных слотов"}
            </p>
          </div>
        )}
      </div>
      <div className="mt-6 flex justify-end space-x-3">
        {onClose && (
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
            disabled={isLoading}
          >
            Отмена
          </button>
        )}
        <button
          onClick={handleSubmit}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
          disabled={isLoading || !bookingTime}
        >
          {isLoading ? "Обработка..." : "Забронировать"}
        </button>
      </div>
    </div>
  );
}