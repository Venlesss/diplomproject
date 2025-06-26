"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import IndividualBookingBlock from "@/app/components/IndividualBookingModal";

interface PriceItem {
  price_id: number;
  name: string;
  price: string;
  description: string;
  is_trainer_service: boolean;
}

export default function UserPage() {
  const params = useParams();
  const router = useRouter();
  const [prices, setPrices] = useState<PriceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBookingBlock, setShowBookingBlock] = useState(false);

  const rawId = params?.id;
  const userId = rawId ? (Array.isArray(rawId) ? rawId[0] : rawId) : null;

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    if (!token) {
      router.push("/");
      return;
    }
    if (role === "1" && userId) {
      router.push(`/profile/${userId}`);
      return;
    }
    if (role === "2" && userId) {
      router.push(`/profile/${userId}`);
      return;
    }

    if (!userId) return;

    const fetchPrices = async () => {
      try {
        const response = await fetch('/api/pricelist');
        const data = await response.json();
        setPrices(data);
      } catch (error) {
        console.error("Ошибка загрузки прайс-листа:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrices();
  }, [userId, router]);

  const handlePurchase = async (priceId: number) => {
    if (!userId) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/");
        return;
      }

      const response = await fetch('/api/bookingssimple', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ priceId })
      });

      if (response.ok) {
        alert("Услуга успешно приобретена!");
        router.push(`/profile/${userId}`);
      } else {
        const data = await response.json();
        alert(`Ошибка: ${data.message || "Не удалось приобрести услугу"}`);
      }
    } catch (error) {
      console.error("Ошибка покупки:", error);
      alert("Ошибка при покупке. Попробуйте позже.");
    }
  };

  if (isLoading || !userId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-xl font-semibold text-white">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="text-white text-xl font-bold">
            Звёздный фитнес
          </Link>
          <div className="flex gap-4">
            <Link
              href={`/profile/${userId}`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-300"
            >
              Личный кабинет
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-8 text-center animate-fade-in">
            Наши услуги
          </h1>
          <button
            onClick={() => setShowBookingBlock(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition duration-300"
          >
            Индивидуальная запись
          </button>
        </div>

        {showBookingBlock && (
          <div className="mb-8">
            <IndividualBookingBlock
              visible={showBookingBlock}
              onClose={() => setShowBookingBlock(false)}
            />
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-600">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-white font-bold text-lg">Услуга</th>
                <th className="px-6 py-4 text-left text-white font-bold text-lg">Описание</th>
                <th className="px-6 py-4 text-right text-white font-bold text-lg">Цена</th>
                <th className="px-6 py-4 text-right text-white font-bold text-lg">Действие</th>
              </tr>
            </thead>
            <tbody>
              {prices.filter(price => !price.is_trainer_service).map((price, index) => (
                <tr 
                  key={index}
                  className="border-b border-gray-600 hover:bg-gray-700 transition-colors"
                >
                  <td className="px-6 py-4 text-gray-300">{price.name}</td>
                  <td className="px-6 py-4 text-gray-300">{price.description}</td>
                  <td className="px-6 py-4 text-right text-blue-400 font-medium">{price.price}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handlePurchase(price.price_id)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                    >
                      Купить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}