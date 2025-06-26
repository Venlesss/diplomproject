"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const AuthForm = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBlockedReason("");

    if (isRegister) {
      if (!formData.username || !formData.email || !formData.password) {
        setError("Заполните все обязательные поля");
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Пароли не совпадают");
        return;
      }
    } else {
      if (!formData.email || !formData.password) {
        setError("Заполните все обязательные поля");
        return;
      }
    }

    try {
      const endpoint = isRegister ? "/api/register" : "/api/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!isRegister && data.blocked) {
        setBlockedReason(data.reason || "Ваш аккаунт заблокирован.");
        return;
      }

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("username", data.username);
        localStorage.setItem("role", data.role);
        router.push(`/user/${data.userId}`);
      } else {
        setError(data.message || "Произошла ошибка");
      }
    } catch (err) {
      console.error("Ошибка:", err);
      setError("Ошибка соединения с сервером");
    }
  };

  if (blockedReason) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8 animate-fade-in flex flex-col items-center">
          <h1 className="text-3xl font-extrabold text-red-500 text-center mb-8">Аккаунт заблокирован</h1>
          <div className="text-white text-lg mb-6 text-center">{blockedReason}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8 animate-fade-in">
        <h1 className="text-3xl md:text-4xl font-extrabold text-white text-center mb-8 tracking-tight">{isRegister ? "Регистрация" : "Вход в аккаунт"}</h1>
        <div className="flex justify-center items-center mb-8 gap-4">
          <button
            onClick={() => setIsRegister(false)}
            className={`px-6 py-2 rounded-lg font-bold transition-colors duration-200 text-lg focus:outline-none ${
              !isRegister ? "bg-blue-600 text-white shadow" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Вход
          </button>
          <button
            onClick={() => setIsRegister(true)}
            className={`px-6 py-2 rounded-lg font-bold transition-colors duration-200 text-lg focus:outline-none ${
              isRegister ? "bg-blue-600 text-white shadow" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Регистрация
          </button>
        </div>

        {error && <div className="text-red-500 mb-6 text-center font-semibold animate-pulse">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isRegister && (
            <div>
              <label className="block text-gray-300 mb-2 font-medium">Имя пользователя</label>
              <input
                type="text"
                className="w-full bg-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-400 border border-gray-600"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Введите имя пользователя"
              />
            </div>
          )}

          <div>
            <label className="block text-gray-300 mb-2 font-medium">Почта</label>
            <input
              type="email"
              className="w-full bg-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-400 border border-gray-600"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="Введите почту"
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2 font-medium">Пароль</label>
            <input
              type="password"
              className="w-full bg-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-400 border border-gray-600"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Введите пароль"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-gray-300 mb-2 font-medium">Подтвердите пароль</label>
              <input
                type="password"
                className="w-full bg-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-400 border border-gray-600"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                placeholder="Повторите пароль"
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition duration-300 shadow-lg text-lg mt-2"
          >
            {isRegister ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-400 hover:text-blue-300 font-medium transition-colors duration-200">
            ← Вернуться на главную
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;