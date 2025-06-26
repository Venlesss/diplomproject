import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
// @ts-ignore
import { registerLocale } from 'react-datepicker';

interface Trainer {
  trainer_id: number;
  first_name: string;
  last_name: string;
  email?: string;
}

interface DaysOffItem {
  id: number;
  type: 'off' | 'vacation';
  date: string | null;
  start_date: string | null;
  end_date: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU');
}

// Функция для получения локальной даты в формате YYYY-MM-DD
function toLocalISODate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// @ts-ignore
registerLocale('ru', ru);

export default function TrainerDaysOffCalendar({ trainers }: { trainers: Trainer[] }) {
  const [selectedTrainerId, setSelectedTrainerId] = useState<number | null>(null);
  const [daysOff, setDaysOff] = useState<DaysOffItem[]>([]);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [vacStart, setVacStart] = useState<Date | null>(null);
  const [vacEnd, setVacEnd] = useState<Date | null>(null);
  const [newType, setNewType] = useState<'off' | 'vacation'>('off');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTrainerId) return;
    setLoading(true);
    fetch(`/api/trainers/${selectedTrainerId}/days-off`)
      .then(res => res.json())
      .then(data => setDaysOff(data))
      .catch(() => setDaysOff([]))
      .finally(() => setLoading(false));
  }, [selectedTrainerId]);

  const handleAdd = async () => {
    if (!selectedTrainerId) return;
    setLoading(true);
    setError(null);
    try {
      if (newType === 'off') {
        if (!newDate) return;
        const isoDate = toLocalISODate(newDate);
        const res = await fetch(`/api/trainers/${selectedTrainerId}/days-off`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'off', date: isoDate })
        });
        if (!res.ok) throw new Error('Ошибка добавления');
        setDaysOff(prev => [...prev, { id: Date.now(), type: 'off', date: isoDate, start_date: null, end_date: null }]);
        setNewDate(null);
      } else {
        if (!vacStart || !vacEnd) return;
        const isoStart = toLocalISODate(vacStart);
        const isoEnd = toLocalISODate(vacEnd);
        const res = await fetch(`/api/trainers/${selectedTrainerId}/days-off`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'vacation', start_date: isoStart, end_date: isoEnd })
        });
        if (!res.ok) throw new Error('Ошибка добавления');
        setDaysOff(prev => [...prev, { id: Date.now(), type: 'vacation', date: null, start_date: isoStart, end_date: isoEnd }]);
        setVacStart(null);
        setVacEnd(null);
      }
    } catch (e) {
      setError('Ошибка добавления даты');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: DaysOffItem) => {
    if (!selectedTrainerId) return;
    setLoading(true);
    setError(null);
    try {
      let body: any = { type: item.type };
      if (item.type === 'off') {
        body.date = item.date;
      } else {
        body.start_date = item.start_date;
        body.end_date = item.end_date;
      }
      const res = await fetch(`/api/trainers/${selectedTrainerId}/days-off`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Ошибка удаления');
      setDaysOff(prev => prev.filter(d => d !== item));
    } catch (e) {
      setError('Ошибка удаления даты');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 p-6 rounded-lg mt-8">
      <h3 className="text-xl font-bold text-white mb-4">Управление выходными и отпуском тренера</h3>
      <div className="mb-4">
        <label className="text-white mr-2">Тренер:</label>
        <select
          className="bg-gray-700 text-white p-2 rounded"
          value={selectedTrainerId || ''}
          onChange={e => setSelectedTrainerId(Number(e.target.value))}
        >
          <option value="">Выберите тренера</option>
          {trainers.map(u => (
            <option key={u.trainer_id} value={u.trainer_id}>{u.first_name} {u.last_name}</option>
          ))}
        </select>
      </div>
      {selectedTrainerId && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <select
              className="bg-gray-700 text-white p-2 rounded"
              value={newType}
              onChange={e => setNewType(e.target.value as 'off' | 'vacation')}
            >
              <option value="off">Выходной</option>
              <option value="vacation">Отпуск</option>
            </select>
            {newType === 'off' ? (
              <DatePicker
                selected={newDate}
                onChange={date => setNewDate(date)}
                minDate={new Date()}
                dateFormat="dd.MM.yyyy"
                className="custom-datepicker-input"
                calendarClassName="custom-datepicker-calendar"
                placeholderText="Выберите дату"
                locale="ru"
                popperContainer={({ children }) => <div style={{ zIndex: 9999, position: 'relative' }}>{children}</div>}
              />
            ) : (
              <>
                <DatePicker
                  selected={vacStart}
                  onChange={date => setVacStart(date)}
                  minDate={new Date()}
                  dateFormat="dd.MM.yyyy"
                  className="custom-datepicker-input"
                  calendarClassName="custom-datepicker-calendar"
                  placeholderText="Начало отпуска"
                  locale="ru"
                  popperContainer={({ children }) => <div style={{ zIndex: 9999, position: 'relative' }}>{children}</div>}
                />
                <span className="text-white">—</span>
                <DatePicker
                  selected={vacEnd}
                  onChange={date => setVacEnd(date)}
                  minDate={vacStart || new Date()}
                  dateFormat="dd.MM.yyyy"
                  className="custom-datepicker-input"
                  calendarClassName="custom-datepicker-calendar"
                  placeholderText="Конец отпуска"
                  locale="ru"
                  popperContainer={({ children }) => <div style={{ zIndex: 9999, position: 'relative' }}>{children}</div>}
                />
              </>
            )}
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              onClick={handleAdd}
              disabled={loading || (newType === 'off' ? !newDate : !vacStart || !vacEnd)}
            >Добавить</button>
          </div>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          {loading ? (
            <div className="text-white">Загрузка...</div>
          ) : (
            <table className="w-full text-left mt-4">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-white">Тип</th>
                  <th className="px-2 py-1 text-white">Дата/Диапазон</th>
                  <th className="px-2 py-1 text-white">Действие</th>
                </tr>
              </thead>
              <tbody>
                {daysOff.length === 0 && (
                  <tr><td colSpan={3} className="text-gray-400 py-2">Нет выходных/отпусков</td></tr>
                )}
                {daysOff.sort((a, b) => {
                  const aDate = a.type === 'off' ? a.date! : a.start_date!;
                  const bDate = b.type === 'off' ? b.date! : b.start_date!;
                  return aDate.localeCompare(bDate);
                }).map(d => (
                  <tr key={d.id}>
                    <td className="px-2 py-1 text-gray-300">{d.type === 'off' ? 'Выходной' : 'Отпуск'}</td>
                    <td className="px-2 py-1 text-gray-300">
                      {d.type === 'off'
                        ? formatDate(d.date)
                        : `${formatDate(d.start_date)} — ${formatDate(d.end_date)}`}
                    </td>
                    <td className="px-2 py-1">
                      <button
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        onClick={() => handleDelete(d)}
                        disabled={loading}
                      >Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
} 