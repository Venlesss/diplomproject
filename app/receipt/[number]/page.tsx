"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const receiptNumber = params?.number ? (Array.isArray(params.number) ? params.number[0] : params.number) : null;
  const [receipt, setReceipt] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!receiptNumber) return;
    setLoading(true);
    fetch(`/api/receipts?number=${receiptNumber}`)
      .then(res => res.ok ? res.json() : Promise.reject("Чек не найден"))
      .then(data => {
        setReceipt(data);
        setLoading(false);
      })
      .catch(e => {
        setError(typeof e === "string" ? e : "Ошибка загрузки чека");
        setLoading(false);
      });
  }, [receiptNumber]);

  useEffect(() => {
    if (!receipt || receipt.status !== "pending") return;
    const interval = setInterval(() => {
      const expires = new Date(receipt.expires_at);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      if (diff <= 0) setTimeLeft("00:00");
      else {
        const min = Math.floor(diff / 60000);
        const sec = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [receipt]);

  const handlePay = async () => {
    if (!receipt) return;
    setPaying(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pay", receipt_id: receipt.receipt_id })
      });
      if (res.ok) {
        setReceipt({ ...receipt, status: "paid", paid_at: new Date().toISOString() });
      } else {
        alert("Ошибка оплаты");
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white">Загрузка...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-400">{error}</div>;
  if (!receipt) return <div className="min-h-screen flex items-center justify-center text-red-400">Чек не найден</div>;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-4">Чек</h2>
        <div className="text-gray-300 mb-2">Тип: {receipt.ticket_type === 'simple' ? 'Обычная услуга' : 'Индивидуальная запись'}</div>
        <div className="text-gray-300 mb-2">Сумма: <span className="text-green-400 font-bold">{receipt.amount}</span></div>
        <div className="text-gray-300 mb-2">Статус: <span className={receipt.status === 'paid' ? 'text-green-400' : receipt.status === 'pending' ? 'text-yellow-400' : 'text-red-400'}>{receipt.status === 'paid' ? 'Оплачен' : receipt.status === 'pending' ? 'Ожидает оплаты' : 'Просрочен'}</span></div>
        {receipt.status === 'pending' && (
          <>
            <div className="text-yellow-400 mb-2">Время для покупки: {timeLeft}</div>
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition w-full mb-2"
              onClick={handlePay}
              disabled={paying}
            >
              {paying ? 'Оплата...' : 'Оплатить'}
            </button>
          </>
        )}
        {receipt.status === 'paid' && (
          <>
            <div className="text-green-400 font-bold text-lg mt-4">Оплачено</div>
            <div className="text-white text-2xl font-mono my-4">{receipt.receipt_number}</div>
            <div className="text-blue-300 text-center mb-2">Покажите или продиктуйте этот номер администратору для подтверждения!</div>
          </>
        )}
        {receipt.status === 'expired' && (
          <div className="text-red-400 font-bold text-lg mt-4">Чек просрочен</div>
        )}
        <button className="mt-4 text-blue-400 underline" onClick={() => router.back()}>Назад</button>
      </div>
    </div>
  );
} 