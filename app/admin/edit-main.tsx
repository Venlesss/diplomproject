"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function EditMainPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "1") {
      router.push("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-white mb-8">Редактирование главной страницы</h1>
      <p className="text-gray-300 text-lg mb-8">Здесь будет редактор блоков главной страницы (прайс-лист, тренеры и т.д.)</p>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold"
        onClick={() => router.push(`/profile/${localStorage.getItem("userId")}`)}
      >
        Вернуться в кабинет
      </button>
    </div>
  );
} 