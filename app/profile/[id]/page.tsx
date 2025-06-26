"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { addMonths, format, isAfter, isSameMonth, startOfMonth } from 'date-fns';
import { formatWithOptions } from 'date-fns/fp';
import { ru } from 'date-fns/locale';
import React from "react";
import AdminPromoteTrainerModal from "@/app/components/AdminPromoteTrainerModal";
import TrainerDaysOffCalendar from "@/app/components/TrainerDaysOffCalendar";
import { format as formatDateFns, differenceInDays } from 'date-fns';

interface Booking {
  booking_id: number;
  booking_date: string;
  status: string;
  first_name: string;
  last_name: string;
  activity: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
}

interface SimpleBooking {
  booking_id: number;
  booking_date: string;
  end_date: string | null;
  status: string;
  name: string;
  price: string;
  description: string;
  visits_left?: number;
}

// Добавляем интерфейс для индивидуальных бронирований
interface IndividualBooking {
  booking_id: number;
  booking_datetime: string;
  status: string;
  specialization: string;
  first_name: string;
  last_name: string;
  service_name?: string;
  service_price?: string;
}

// Новый хук для загрузки чеков по тикетам
function useReceiptsForBookings(bookings: any[], type: string) {
  const [receipts, setReceipts] = useState<Record<number, any>>({});
  useEffect(() => {
    let cancelled = false;
    async function fetchReceipts() {
      const result: Record<number, any> = {};
      for (const booking of bookings) {
        try {
          const res = await fetch(`/api/receipts?ticket_id=${booking.booking_id}&ticket_type=${type}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.receipt_id) result[booking.booking_id] = data;
          }
        } catch {}
      }
      if (!cancelled) setReceipts(result);
    }
    if (bookings.length > 0) fetchReceipts();
    else setReceipts({});
    return () => { cancelled = true; };
  }, [bookings, type]);
  return receipts;
}

// Async функция для загрузки чеков по тикетам (НЕ хук)
async function fetchReceiptsForBookings(bookings: any[], type: string) {
  const result: Record<number, any> = {};
  for (const booking of bookings) {
    try {
      const res = await fetch(`/api/receipts?ticket_id=${booking.booking_id}&ticket_type=${type}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.receipt_id) result[booking.booking_id] = data;
      }
    } catch {}
  }
  return result;
}

// Компонент для тикета с чеком и таймером
function TicketWithReceipt({ booking, receipt, onRefuse, children, reloadProfileData }: { booking: any, receipt: any, onRefuse: () => void, children?: React.ReactNode, reloadProfileData?: () => void }) {
  const [timeLeft, setTimeLeft] = useState('');
  const timerExpiredRef = useRef(false);
  useEffect(() => {
    if (!receipt || receipt.status !== 'pending') return;
    const interval = setInterval(() => {
      const expires = new Date(receipt.expires_at);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      if (diff <= 0) setTimeLeft('00:00');
      else {
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [receipt]);

  // Новый useEffect для автоудаления и обновления
  useEffect(() => {
    if (timeLeft === '00:00' && receipt && receipt.status === 'pending' && !timerExpiredRef.current) {
      timerExpiredRef.current = true;
      fetch('/api/receipts?expired=1', { method: 'DELETE' })
        .then(() => {
          if (reloadProfileData) reloadProfileData();
        });
    }
  }, [timeLeft, receipt, reloadProfileData]);

  return (
    <div className="flex flex-col gap-2">
      {children}
      {receipt && receipt.status === 'paid' && (
        <>
          <div className="text-green-400 mt-2">Оплачено</div>
          <div className="text-white text-xl font-mono my-2">Номер чека: {receipt.receipt_number}</div>
          <div className="text-blue-300 text-sm">Покажите или продиктуйте этот номер администратору!</div>
        </>
      )}
      {receipt && receipt.status === 'pending' && (
        <div className="flex flex-col gap-2 mt-2">
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            onClick={() => window.location.href = `/receipt/${receipt.receipt_number}`}
          >
            Оплатить
          </button>
          <div className="text-yellow-400">Время для покупки: {timeLeft}</div>
          <button
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
            onClick={onRefuse}
          >
            Отказаться
          </button>
        </div>
      )}
    </div>
  );
}

// Добавляю функцию для капитализации первой буквы
function capitalizeFirstLetter(str: string) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const ProfilePage = () => {
  const params = useParams();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [simpleBookings, setSimpleBookings] = useState<SimpleBooking[]>([]);
  const [individualBookings, setIndividualBookings] = useState<IndividualBooking[]>([]); // Новое состояние
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showTrainers, setShowTrainers] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [blockModal, setBlockModal] = useState<{ open: boolean, user: any | null }>({ open: false, user: null });
  const [blockReason, setBlockReason] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);
  const blockReasonInput = useRef<HTMLInputElement>(null);
  const [trainerBookings, setTrainerBookings] = useState<any[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);
  const [expandedUserBookings, setExpandedUserBookings] = useState<any | null>(null);
  const [expandedUserLoading, setExpandedUserLoading] = useState(false);
  const [promoteModal, setPromoteModal] = useState<{ open: boolean, user: any | null }>({ open: false, user: null });
  const [trainers, setTrainers] = useState<any[]>([]);
  const [showCheck, setShowCheck] = useState(false);
  const [checkNumber, setCheckNumber] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [checkError, setCheckError] = useState("");
  const [checkLoading, setCheckLoading] = useState(false);
  const [expandedSimpleReceipts, setExpandedSimpleReceipts] = useState<Record<number, any>>({});
  const [expandedIndividualReceipts, setExpandedIndividualReceipts] = useState<Record<number, any>>({});

  const rawId = params?.id;
  const userId = rawId ? (Array.isArray(rawId) ? rawId[0] : rawId) : null;

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchBlockedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/blocked-users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBlockedUsers(data);
    } catch (e) {
      setBlockedUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handlePromote = async (userId: number) => {
    const token = localStorage.getItem("token");
    await fetch(`/api/users/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    });
    fetchUsers();
  };

  const handleDemote = async (userId: number) => {
    const token = localStorage.getItem("token");
    await fetch(`/api/users/demote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    });
    fetchUsers();
  };

  const handleBlock = async () => {
    if (!blockModal.user || !blockReason) return;
    setBlockLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: blockModal.user.user_id, reason: blockReason }),
      });
      if (res.ok) {
        setBlockModal({ open: false, user: null });
        setBlockReason("");
        fetchUsers();
        fetchBlockedUsers();
      } else {
        const data = await res.json();
        alert(data.message || "Ошибка блокировки");
      }
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async (blockedId: number) => {
    setBlockLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/users/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ blockedId }),
      });
      if (res.ok) {
        fetchUsers();
        fetchBlockedUsers();
      } else {
        const data = await res.json();
        alert(data.message || "Ошибка разблокировки");
      }
    } finally {
      setBlockLoading(false);
    }
  };

  const fetchUserBookings = async (userId: number) => {
    setExpandedUserLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Получаем обычные записи
      const bookingsRes = await fetch(`/api/bookings?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const bookings = await bookingsRes.json();
      // Получаем простые записи
      const simpleRes = await fetch(`/api/bookingssimple?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const simpleBookings = await simpleRes.json();
      // Получаем индивидуальные записи
      const individualRes = await fetch(`/api/individualbookings?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const individualBookings = await individualRes.json();
      setExpandedUserBookings({ bookings, simpleBookings, individualBookings });
    } catch (e) {
      setExpandedUserBookings(null);
    } finally {
      setExpandedUserLoading(false);
    }
  };

  const handleVisitsChange = async (booking_id: number, current: number, delta: number) => {
    if (typeof current !== 'number') return;
    const token = localStorage.getItem('token');
    const res = await fetch('/api/bookingssimple', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id, visits_left: current + delta }),
    });
    if (res.ok) {
      if (expandedUserId) fetchUserBookings(expandedUserId);
    } else {
      alert('Ошибка изменения количества посещений');
    }
  };

  const handleAdminDeleteBooking = async (type: 'simple' | 'individual', booking_id: number) => {
    const token = localStorage.getItem('token');
    const url = type === 'simple' ? '/api/bookingssimple' : '/api/individualbookings';
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id }),
    });
    if (res.ok) {
      if (expandedUserId) fetchUserBookings(expandedUserId);
    } else {
      alert('Ошибка при удалении записи');
    }
  };

  // Вынес fetchBookings наружу, чтобы можно было передавать как пропс
  const fetchBookings = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const [trainerBookingsRes, simpleBookingsRes, individualBookingsRes] = await Promise.all([
        fetch('/api/bookings', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/bookingssimple', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/individualbookings', {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);
  
      const trainerBookingsData = trainerBookingsRes.ok ? await trainerBookingsRes.json() : [];
      const simpleBookingsData = simpleBookingsRes.ok ? await simpleBookingsRes.json() : [];
      const individualBookingsData = individualBookingsRes.ok ? await individualBookingsRes.json() : [];
  
      setBookings(trainerBookingsData);
      setSimpleBookings(simpleBookingsData);
      setIndividualBookings(individualBookingsData);
    } catch (error) {
      console.error("Ошибка загрузки бронирований:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userRole = localStorage.getItem("role");
    setRole(userRole);
    if (!token) {
      router.push("/");
      return;
    }
    if (userRole === "2") {
      // Получаем все индивидуальные бронирования, где тренер — текущий пользователь
      const fetchTrainerBookings = async () => {
        try {
          const res = await fetch("/api/individualbookings?asTrainer=1", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          setTrainerBookings(data);
        } catch (e) {
          setTrainerBookings([]);
        }
      };
      fetchTrainerBookings();
      return;
    }
    if (userId) fetchBookings();
  }, [userId, router, fetchBookings]);

  useEffect(() => {
    fetch('/api/trainers/list')
      .then(res => res.json())
      .then(setTrainers)
      .catch(() => setTrainers([]));
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Получаем чеки для простых и индивидуальных бронирований
  const simpleReceipts = useReceiptsForBookings(simpleBookings, 'simple');
  const individualReceipts = useReceiptsForBookings(individualBookings, 'individual');

  useEffect(() => {
    if (expandedUserBookings && expandedUserBookings.simpleBookings) {
      (async () => {
        const receipts = await fetchReceiptsForBookings(expandedUserBookings.simpleBookings, 'simple');
        setExpandedSimpleReceipts(receipts);
      })();
    } else {
      setExpandedSimpleReceipts({});
    }
  }, [expandedUserBookings]);

  useEffect(() => {
    if (expandedUserBookings && expandedUserBookings.individualBookings) {
      (async () => {
        const receipts = await fetchReceiptsForBookings(expandedUserBookings.individualBookings, 'individual');
        setExpandedIndividualReceipts(receipts);
      })();
    } else {
      setExpandedIndividualReceipts({});
    }
  }, [expandedUserBookings]);

  async function handleCheckSearch() {
    setCheckLoading(true);
    setCheckError("");
    setCheckResult(null);
    try {
      const res = await fetch(`/api/receipts?number=${checkNumber}`);
      if (!res.ok) throw new Error("Чек не найден");
      const data = await res.json();
      setCheckResult(data);
    } catch (e: any) {
      setCheckError(e.message || "Ошибка поиска");
    } finally {
      setCheckLoading(false);
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/receipts?expired=1', { method: 'DELETE' });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Добавлено: автоматический выбор вкладки "Пользователи" для администратора при первой загрузке
  useEffect(() => {
    const userRole = localStorage.getItem("role");
    if (userRole === "1") {
      setShowUsers(true);
      setShowBlocked(false);
      setShowTrainers(false);
      fetchUsers();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-white text-xl font-bold">
            Звёздный фитнес
          </Link>
          <div className="flex gap-4 items-center">
            {role !== "1" && role !== "2" && (
              <Link
                href={`/user/${userId}`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-300"
              >
                Назад к услугам
              </Link>
            )}
            <button
              onClick={() => {
                localStorage.clear();
                router.push("/");
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition duration-300"
            >
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-white mb-8 text-center animate-fade-in">
          Личный кабинет
        </h1>

        {/* Интерфейс для администратора */}
        {role === "1" && (
          <div className="flex flex-row gap-8">
            {/* Sidebar */}
            <div className="flex flex-col w-64 bg-gray-800 rounded-2xl p-4 h-fit mr-8 shadow-xl">
              <button
                className={`w-full px-6 py-4 mb-3 rounded-xl text-lg font-bold text-left flex items-center gap-2 transition-all duration-200 relative
                  ${showUsers && !showBlocked && !showTrainers ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-200 hover:bg-blue-500 hover:text-white'}
                `}
                style={showUsers && !showBlocked && !showTrainers ? { boxShadow: '0 4px 16px 0 rgba(59,130,246,0.25)' } : {}}
                onClick={() => { setShowUsers(true); setShowBlocked(false); setShowTrainers(false); setShowCheck(false); fetchUsers(); }}
              >
                {showUsers && !showBlocked && !showTrainers && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-blue-400 rounded-r-xl"></span>}
                Пользователи
              </button>
              <button
                className={`w-full px-6 py-4 mb-3 rounded-xl text-lg font-bold text-left flex items-center gap-2 transition-all duration-200 relative
                  ${showTrainers ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-200 hover:bg-blue-500 hover:text-white'}
                `}
                style={showTrainers ? { boxShadow: '0 4px 16px 0 rgba(59,130,246,0.25)' } : {}}
                onClick={() => { setShowTrainers(true); setShowUsers(false); setShowBlocked(false); setShowCheck(false); fetchUsers(); }}
              >
                {showTrainers && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-blue-400 rounded-r-xl"></span>}
                Тренера
              </button>
              <button
                className={`w-full px-6 py-4 mb-3 rounded-xl text-lg font-bold text-left flex items-center gap-2 transition-all duration-200 relative
                  ${showBlocked ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-200 hover:bg-blue-500 hover:text-white'}
                `}
                style={showBlocked ? { boxShadow: '0 4px 16px 0 rgba(59,130,246,0.25)' } : {}}
                onClick={() => { setShowBlocked(true); setShowUsers(false); setShowTrainers(false); setShowCheck(false); fetchBlockedUsers(); }}
              >
                {showBlocked && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-blue-400 rounded-r-xl"></span>}
                Заблокированные пользователи
              </button>
              <button
                className={`w-full px-6 py-4 mb-3 rounded-xl text-lg font-bold text-left flex items-center gap-2 transition-all duration-200 relative
                  ${showCheck ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-200 hover:bg-blue-500 hover:text-white'}
                `}
                style={showCheck ? { boxShadow: '0 4px 16px 0 rgba(59,130,246,0.25)' } : {}}
                onClick={() => { setShowCheck(true); setShowUsers(false); setShowBlocked(false); setShowTrainers(false); }}
              >
                {showCheck && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-blue-400 rounded-r-xl"></span>}
                Проверка чека
              </button>
              <button
                className="w-full px-6 py-4 rounded-xl text-lg font-bold text-left bg-gray-700 hover:bg-blue-500 hover:text-white text-gray-200 transition-all duration-200 mt-2"
                onClick={() => {
                  localStorage.setItem("editMain", "1");
                  router.push("/");
                }}
              >
                <span className="inline-block mr-2">🛠️</span> Редактировать главную страницу
              </button>
            </div>
            {/* Content */}
            <div className="flex-1">
              {showUsers && !showBlocked && !showTrainers && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold text-white mb-4">Все пользователи</h2>
                  {usersLoading ? (
                    <div className="text-white">Загрузка...</div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-white">ID</th>
                          <th className="px-4 py-2 text-white">Имя</th>
                          <th className="px-4 py-2 text-white">Почта</th>
                          <th className="px-4 py-2 text-white">Роль</th>
                          <th className="px-4 py-2 text-white">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.filter((u) => u.role === 3).map((u) => (
                          <React.Fragment key={u.user_id}>
                            <tr className="cursor-pointer hover:bg-gray-700 transition" onClick={() => {
                              if (expandedUserId === u.user_id) {
                                setExpandedUserId(null);
                              } else {
                                setExpandedUserId(u.user_id);
                                fetchUserBookings(u.user_id);
                              }
                            }}>
                              <td className="px-4 py-2 text-gray-300">{u.user_id}</td>
                              <td className="px-4 py-2 text-gray-300">{u.username}</td>
                              <td className="px-4 py-2 text-gray-300">{u.email}</td>
                              <td className="px-4 py-2 text-gray-300">Пользователь</td>
                              <td className="px-4 py-2 flex gap-2">
                                <button title="Сделать тренером" onClick={e => { e.stopPropagation(); setPromoteModal({ open: true, user: u }); }}>
                                  <span role="img" aria-label="star" className="text-yellow-400 text-2xl">★</span>
                                </button>
                                <button
                                  title="Заблокировать"
                                  onClick={e => { e.stopPropagation(); setBlockModal({ open: true, user: u }); }}
                                  style={{ background: 'none', border: 'none', boxShadow: 'none', padding: 0, margin: 0, outline: 'none' }}
                                >
                                  <span role="img" aria-label="block" className="text-red-500 text-2xl">🚫</span>
                                </button>
                              </td>
                            </tr>
                            {expandedUserId === u.user_id && (
                              <tr>
                                <td colSpan={5} className="bg-gray-900 px-4 py-4">
                                  {expandedUserLoading ? (
                                    <div className="text-white">Загрузка записей...</div>
                                  ) : expandedUserBookings ? (
                                    <div className="space-y-4">
                                      <div>
                                        <div className="text-lg text-purple-400 font-bold mb-2">Абонементы/простые записи:</div>
                                        {expandedUserBookings.simpleBookings && expandedUserBookings.simpleBookings.length > 0 ? (
                                          expandedUserBookings.simpleBookings.map((booking: any) => (
                                            <div key={booking.booking_id} className="bg-gray-700 p-4 rounded-lg mb-4">
                                              <TicketWithReceipt
                                                booking={booking}
                                                receipt={expandedSimpleReceipts[booking.booking_id]}
                                                onRefuse={async () => {
                                                  if (!confirm('Вы уверены, что хотите отказаться от абонемента?')) return;
                                                  try {
                                                    const token = localStorage.getItem('token');
                                                    const res = await fetch('/api/bookingssimple', {
                                                      method: 'DELETE',
                                                      headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${token}`,
                                                      },
                                                      body: JSON.stringify({ booking_id: booking.booking_id }),
                                                    });
                                                    if (res.ok) {
                                                      fetchUserBookings(u.user_id);
                                                    } else {
                                                      const data = await res.json();
                                                      alert(data.message || 'Ошибка при отмене абонемента');
                                                    }
                                                  } catch (e) {
                                                    alert('Ошибка при отмене абонемента');
                                                  }
                                                }}
                                                reloadProfileData={fetchBookings}
                                              >
                                                <div className="flex justify-between items-start">
                                                  <div>
                                                    <p className="text-white font-medium">{booking.name}</p>
                                                    <p className="text-gray-300">{booking.description}</p>
                                                    <p className="text-green-400">Цена: {booking.price}</p>
                                                    <p className="text-gray-300">Дата покупки: {formatDate(booking.booking_date)}</p>
                                                    {booking.end_date && (
                                                      <>
                                                        <p className="text-gray-300">Действителен до: {formatDate(booking.end_date)}</p>
                                                        <p className="text-yellow-400">
                                                          {(() => {
                                                            const end = new Date(booking.end_date);
                                                            const now = new Date();
                                                            const diffMs = end.getTime() - now.getTime();
                                                            if (diffMs <= 0) return 'Срок действия истёк';
                                                            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                            const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                                                            const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
                                                            return `Закончится через: ${days} дн., ${hours} ч., ${minutes} мин.`;
                                                          })()}
                                                        </p>
                                                      </>
                                                    )}
                                                    {booking.visits_left !== undefined && booking.visits_left !== null && (
                                                      <p className="text-yellow-400">Посещений осталось: {booking.visits_left}</p>
                                                    )}
                                                    <p className="text-gray-300">Статус: {booking.status}</p>
                                                  </div>
                                                </div>
                                              </TicketWithReceipt>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-gray-300">Нет активных абонементов</div>
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-lg text-green-400 font-bold mb-2">Индивидуальные записи:</div>
                                        {expandedUserBookings.individualBookings && expandedUserBookings.individualBookings.length > 0 ? (
                                          expandedUserBookings.individualBookings.map((booking: any) => (
                                            <div key={booking.booking_id} className="bg-gray-700 p-4 rounded-lg mb-4">
                                              <TicketWithReceipt
                                                booking={booking}
                                                receipt={expandedIndividualReceipts[booking.booking_id]}
                                                onRefuse={async () => {
                                                  if (!confirm('Вы уверены, что хотите отказаться от брони?')) return;
                                                  try {
                                                    const token = localStorage.getItem('token');
                                                    const res = await fetch('/api/individualbookings', {
                                                      method: 'DELETE',
                                                      headers: {
                                                        'Content-Type': 'application/json',
                                                        'Authorization': `Bearer ${token}`,
                                                      },
                                                      body: JSON.stringify({ booking_id: booking.booking_id }),
                                                    });
                                                    if (res.ok) {
                                                      fetchUserBookings(u.user_id);
                                                    } else {
                                                      const data = await res.json();
                                                      alert(data.message || 'Ошибка при отмене бронирования');
                                                    }
                                                  } catch (e) {
                                                    alert('Ошибка при отмене бронирования');
                                                  }
                                                }}
                                                reloadProfileData={fetchBookings}
                                              >
                                                <div className="flex justify-between items-start">
                                                  <div>
                                                    <p className="text-white font-medium">{booking.specialization}</p>
                                                    <p className="text-gray-300">Тренер: {booking.first_name} {booking.last_name}</p>
                                                    {booking.service_name && (
                                                      <p className="text-gray-300">Услуга: {booking.service_name}</p>
                                                    )}
                                                    {booking.service_price && (
                                                      <p className="text-green-400">Цена: {booking.service_price}</p>
                                                    )}
                                                    <p className="text-gray-300">Дата и время: {formatDateTime(booking.booking_datetime)}</p>
                                                  </div>
                                                </div>
                                              </TicketWithReceipt>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-gray-300">Нет индивидуальных занятий</div>
                                        )}
                                      </div>
                                    </div>
                                  ) : <div className="text-red-400">Ошибка загрузки записей</div>}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {showTrainers && !showUsers && !showBlocked && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold text-white mb-4">Тренера</h2>
                  {usersLoading ? (
                    <div className="text-white">Загрузка...</div>
                  ) : (
                    <>
                      <table className="w-full text-left mb-8">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-white">ID</th>
                            <th className="px-4 py-2 text-white">Имя</th>
                            <th className="px-4 py-2 text-white">Почта</th>
                            <th className="px-4 py-2 text-white">Роль</th>
                            <th className="px-4 py-2 text-white">Действие</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.filter((u) => u.role === 2).map((u) => (
                            <tr key={u.user_id}>
                              <td className="px-4 py-2 text-gray-300">{u.user_id}</td>
                              <td className="px-4 py-2 text-gray-300">{u.username}</td>
                              <td className="px-4 py-2 text-gray-300">{u.email}</td>
                              <td className="px-4 py-2 text-gray-300">Тренер</td>
                              <td className="px-4 py-2 flex gap-2">
                                <button
                                  title="Сделать обычным пользователем"
                                  onClick={e => { e.stopPropagation(); handleDemote(u.user_id); }}
                                  style={{ background: 'none', border: 'none', boxShadow: 'none', padding: 0, margin: 0, outline: 'none' }}
                                >
                                  <span role="img" aria-label="demote" className="text-blue-400 text-2xl">⬇️</span>
                                </button>
                                <button title="Заблокировать" onClick={e => { e.stopPropagation(); setBlockModal({ open: true, user: u }); }}
                                  style={{ background: 'none', border: 'none', boxShadow: 'none', padding: 0, margin: 0, outline: 'none' }}>
                                  <span role="img" aria-label="block" className="text-red-500 text-2xl">🚫</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {/* Календарь управления выходными/отпуском тренера */}
                      <TrainerDaysOffCalendar trainers={trainers} />
                    </>
                  )}
                </div>
              )}
              {showBlocked && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold text-white mb-4">Заблокированные пользователи</h2>
                  {usersLoading ? (
                    <div className="text-white">Загрузка...</div>
                  ) : (
                    <table className="w-full text-left">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-white">ID</th>
                          <th className="px-4 py-2 text-white">Имя</th>
                          <th className="px-4 py-2 text-white">Почта</th>
                          <th className="px-4 py-2 text-white">Причина</th>
                          <th className="px-4 py-2 text-white">Дата</th>
                          <th className="px-4 py-2 text-white">Действие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blockedUsers.map((u) => (
                          <tr key={u.blocked_id}>
                            <td className="px-4 py-2 text-gray-300">{u.user_id}</td>
                            <td className="px-4 py-2 text-gray-300">{u.username}</td>
                            <td className="px-4 py-2 text-gray-300">{u.email}</td>
                            <td className="px-4 py-2 text-gray-300">{u.reason}</td>
                            <td className="px-4 py-2 text-gray-300">{u.blocked_at ? new Date(u.blocked_at).toLocaleString() : ''}</td>
                            <td className="px-4 py-2">
                              <button title="Разблокировать" onClick={() => handleUnblock(u.blocked_id)}>
                                <span role="img" aria-label="unblock" className="text-green-500 text-2xl">✔️</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
              {showCheck && (
                <div className="bg-gray-800 p-6 rounded-lg">
                  <h2 className="text-2xl font-bold text-white mb-4">Проверка чека</h2>
                  <div className="flex gap-2 mb-4">
                    <input
                      className="p-2 rounded bg-gray-700 text-white"
                      placeholder="Введите номер чека"
                      value={checkNumber}
                      onChange={e => setCheckNumber(e.target.value)}
                    />
                    <button
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                      onClick={handleCheckSearch}
                      disabled={checkLoading || !checkNumber}
                    >
                      Найти
                    </button>
                  </div>
                  {checkLoading && <div className="text-white">Загрузка...</div>}
                  {checkError && <div className="text-red-400">{checkError}</div>}
                  {checkResult && (
                    <div className="bg-gray-700 p-4 rounded-lg mt-4">
                      {checkResult.ticket_type === 'simple' ? (
                        <>
                          <div className="text-white font-bold mb-2">Тип: Обычная услуга — {checkResult.service_name}</div>
                          <div className="text-gray-300 mb-1">Сумма: {checkResult.amount}</div>
                          <div className="text-gray-300 mb-1">Статус: <span className={checkResult.status === 'paid' ? 'text-green-400' : checkResult.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}>{checkResult.status_ru}</span></div>
                          <div className="text-gray-300 mb-1">Имя: {checkResult.user_name}</div>
                          <div className="text-gray-300 mb-1">Почта: {checkResult.user_email}</div>
                          {checkResult.service_name && (checkResult.service_name.includes('безлимит') || checkResult.service_name.toLowerCase().includes('безлимит')) ? (
                            <div className="text-gray-300 mb-1">
                              Действует с {checkResult.booking_date ? format(new Date(checkResult.booking_date), 'dd.MM.yyyy') : ''} по {checkResult.end_date ? format(new Date(checkResult.end_date), 'dd.MM.yyyy') : ''}<br/>
                              Осталось дней: {checkResult.end_date ? Math.max(0, differenceInDays(new Date(checkResult.end_date), new Date())) : '-'}
                            </div>
                          ) : (
                            <div className="text-gray-300 mb-1 flex items-center gap-2">
                              Количество посещений:
                              <VisitsAdminBlock bookingId={checkResult.ticket_id} />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-white font-bold mb-2">Тип: Индивидуальная запись</div>
                          <div className="text-gray-300 mb-1">К кому: {checkResult.trainer_name}</div>
                          <div className="text-gray-300 mb-1">Специализация: {checkResult.specialization}</div>
                          <div className="text-gray-300 mb-1">Сумма: {checkResult.amount}</div>
                          <div className="text-gray-300 mb-1">Статус: <span className={checkResult.status === 'paid' ? 'text-green-400' : checkResult.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}>{checkResult.status_ru}</span></div>
                          <div className="text-gray-300 mb-1">Имя: {checkResult.user_name}</div>
                          <div className="text-gray-300 mb-1">Почта: {checkResult.user_email}</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Интерфейс для тренера */}
        {role === "2" && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-8 text-center">Записи</h1>
            {/* Группировка по месяцам */}
            {Array.isArray(trainerBookings) && trainerBookings.length > 0 ? (() => {
              // Фильтруем только будущие и текущий месяц
              const now = new Date();
              const bookingsByMonth: { [month: string]: any[] } = {};
              trainerBookings.forEach(b => {
                const date = new Date(b.booking_datetime);
                const monthKey = format(date, 'yyyy-MM');
                if (isAfter(date, startOfMonth(now)) || isSameMonth(date, now)) {
                  if (!bookingsByMonth[monthKey]) bookingsByMonth[monthKey] = [];
                  bookingsByMonth[monthKey].push(b);
                }
              });
              const months = Object.keys(bookingsByMonth).sort();
              if (months.length === 0) return <div className="text-white">Нет записей</div>;
              return months.map(monthKey => {
                const monthDate = new Date(monthKey + '-01');
                // Группировка по дням
                const days: { [day: string]: any[] } = {};
                bookingsByMonth[monthKey].forEach(b => {
                  const dayKey = format(new Date(b.booking_datetime), 'yyyy-MM-dd');
                  if (!days[dayKey]) days[dayKey] = [];
                  days[dayKey].push(b);
                });
                const dayKeys = Object.keys(days).sort();
                return (
                  <div key={monthKey} className="mb-4">
                    <button
                      className="w-full text-left px-4 py-2 bg-gray-700 text-white font-bold rounded-lg mb-2 hover:bg-blue-700 transition"
                      onClick={() => {
                        setExpandedMonths(prev =>
                          prev.includes(monthKey)
                            ? prev.filter(m => m !== monthKey)
                            : [...prev, monthKey]
                        );
                      }}
                    >
                      {capitalizeFirstLetter(formatWithOptions({ locale: ru }, 'LLLL yyyy')(monthDate))}
                    </button>
                    {expandedMonths.includes(monthKey) && (
                      <div className="pl-4">
                        {dayKeys.map(dayKey => (
                          <div key={dayKey}>
                            <button
                              className="w-full text-left px-4 py-1 bg-gray-600 text-white rounded hover:bg-blue-600 transition mb-1"
                              onClick={() => {
                                setExpandedDays(prev =>
                                  prev.includes(dayKey)
                                    ? prev.filter(d => d !== dayKey)
                                    : [...prev, dayKey]
                                );
                              }}
                            >
                              {capitalizeFirstLetter(formatWithOptions({ locale: ru }, 'd MMMM, EEEE')(new Date(dayKey)))}
                            </button>
                            {expandedDays.includes(dayKey) && (
                              <div className="pl-4">
                                {days[dayKey].map(b => {
                                  const start = new Date(b.booking_datetime);
                                  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
                                  return (
                                    <div key={b.booking_id} className="bg-gray-800 p-4 rounded-lg mb-2 border border-blue-700">
                                      <div className="text-white font-bold">
                                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                      </div>
                                      <div className="text-gray-300">Пользователь: {b.user_name}</div>
                                      <div className="text-gray-300">Услуга: {b.specialization}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })() : <div className="text-white">Нет записей</div>}
          </div>
        )}
        {/* Обычный пользователь */}
        {role === "3" && !isLoading && (
          <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Секция простых бронирований (абонементов) */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-2xl font-bold text-white mb-4">
                Активные абонементы
              </h2>
              {simpleBookings.length > 0 ? (
                simpleBookings.map((booking) => (
                  <div key={booking.booking_id} className="bg-gray-700 p-4 rounded-lg mb-4">
                    <TicketWithReceipt
                      booking={booking}
                      receipt={simpleReceipts[booking.booking_id]}
                      onRefuse={async () => {
                        if (!confirm('Вы уверены, что хотите отказаться от абонемента?')) return;
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch('/api/bookingssimple', {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({ booking_id: booking.booking_id }),
                          });
                          if (res.ok) {
                            setSimpleBookings(simpleBookings.filter(b => b.booking_id !== booking.booking_id));
                          } else {
                            const data = await res.json();
                            alert(data.message || 'Ошибка при отмене абонемента');
                          }
                        } catch (e) {
                          alert('Ошибка при отмене абонемента');
                        }
                      }}
                      reloadProfileData={fetchBookings}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{booking.name}</p>
                          <p className="text-gray-300">{booking.description}</p>
                          <p className="text-green-400">Цена: {booking.price}</p>
                          <p className="text-gray-300">Дата покупки: {formatDate(booking.booking_date)}</p>
                          {booking.end_date && (
                            <>
                              <p className="text-gray-300">Действителен до: {formatDate(booking.end_date)}</p>
                              <p className="text-yellow-400">
                                {(() => {
                                  const end = new Date(booking.end_date);
                                  const now = new Date();
                                  const diffMs = end.getTime() - now.getTime();
                                  if (diffMs <= 0) return 'Срок действия истёк';
                                  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
                                  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
                                  return `Закончится через: ${days} дн., ${hours} ч., ${minutes} мин.`;
                                })()}
                              </p>
                            </>
                          )}
                          {booking.visits_left !== undefined && booking.visits_left !== null && (
                            <p className="text-yellow-400">Посещений осталось: {booking.visits_left}</p>
                          )}
                          <p className="text-gray-300">Статус: {booking.status}</p>
                        </div>
                      </div>
                    </TicketWithReceipt>
                  </div>
                ))
              ) : (
                <p className="text-gray-300">Нет активных абонементов</p>
              )}
            </div>
            {/* Новая секция для индивидуальных бронирований */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-2xl font-bold text-white mb-4">
                Индивидуальные занятия
              </h2>
              {individualBookings.length > 0 ? (
                individualBookings.map((booking) => (
                  <div key={booking.booking_id} className="bg-gray-700 p-4 rounded-lg mb-4">
                    <TicketWithReceipt
                      booking={booking}
                      receipt={individualReceipts[booking.booking_id]}
                      onRefuse={async () => {
                        if (!confirm('Вы уверены, что хотите отказаться от брони?')) return;
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch('/api/individualbookings', {
                            method: 'DELETE',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({ booking_id: booking.booking_id }),
                          });
                          if (res.ok) {
                            setIndividualBookings(individualBookings.filter(b => b.booking_id !== booking.booking_id));
                          } else {
                            const data = await res.json();
                            alert(data.message || 'Ошибка при отмене бронирования');
                          }
                        } catch (e) {
                          alert('Ошибка при отмене бронирования');
                        }
                      }}
                      reloadProfileData={fetchBookings}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{booking.specialization}</p>
                          <p className="text-gray-300">Тренер: {booking.first_name} {booking.last_name}</p>
                          {booking.service_name && (
                            <p className="text-gray-300">Услуга: {booking.service_name}</p>
                          )}
                          {booking.service_price && (
                            <p className="text-green-400">Цена: {booking.service_price}</p>
                          )}
                          <p className="text-gray-300">Дата и время: {formatDateTime(booking.booking_datetime)}</p>
                        </div>
                      </div>
                    </TicketWithReceipt>
                  </div>
                ))
              ) : (
                <p className="text-gray-300">Нет активных индивидуальных занятий</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно блокировки */}
      {blockModal.open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-2xl font-bold text-white mb-4">Блокировка пользователя</h2>
            <p className="text-gray-300 mb-2">Пользователь: <b>{blockModal.user?.username}</b> ({blockModal.user?.email})</p>
            <input
              ref={blockReasonInput}
              className="w-full p-2 rounded bg-gray-700 text-white mb-4"
              placeholder="Причина блокировки"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                onClick={() => { setBlockModal({ open: false, user: null }); setBlockReason(""); }}
              >
                Отмена
              </button>
              <button
                className={`bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded ${!blockReason ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!blockReason || blockLoading}
                onClick={handleBlock}
              >
                Заблокировать
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminPromoteTrainerModal
        isOpen={promoteModal.open}
        onClose={() => setPromoteModal({ open: false, user: null })}
        user={promoteModal.user}
        onPromote={fetchUsers}
      />
    </div>
  );
};

function VisitsAdminBlock({ bookingId }: { bookingId: number }) {
  const [visits, setVisits] = useState<number|null>(null);
  const [loading, setLoading] = useState(false);
  async function handleVisitsChangeAdmin(current: number, delta: number) {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/bookingssimple', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ booking_id: bookingId, visits_left: current + delta }),
    });
    if (!res.ok) alert('Ошибка изменения посещений');
  }
  useEffect(() => {
    async function fetchVisits() {
      setLoading(true);
      const res = await fetch(`/api/bookingssimple?booking_id=${bookingId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0] && typeof data[0].visits_left === 'number') setVisits(data[0].visits_left);
      }
      setLoading(false);
    }
    fetchVisits();
  }, [bookingId]);
  if (loading) return <div className="text-white">Загрузка посещений...</div>;
  if (visits === null) return <div className="text-red-400">Не удалось получить количество посещений</div>;
  return (
    <div className="flex items-center gap-2 mt-2">
      <button className="bg-gray-600 text-white px-2 py-1 rounded" onClick={() => { handleVisitsChangeAdmin(visits, -1); setVisits(v => (v!==null?v-1:v)); }} disabled={visits <= 0}>-</button>
      <span className="text-white">{visits}</span>
      <button className="bg-gray-600 text-white px-2 py-1 rounded" onClick={() => { handleVisitsChangeAdmin(visits, 1); setVisits(v => (v!==null?v+1:v)); }}>+</button>
    </div>
  );
}

export default ProfilePage;