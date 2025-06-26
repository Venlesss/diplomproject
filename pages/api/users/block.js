import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Метод не разрешен' });
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Не авторизован' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Недействительный токен' });
  }
  if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
  const { userId, reason } = req.body;
  if (!userId || !reason) return res.status(400).json({ message: 'Не переданы userId или причина' });
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4', user: 'root', database: 'projectdiplom', password: ''
  });
  try {
    // Получаем пользователя
    const [users] = await connection.execute('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ message: 'Пользователь не найден' });
    const user = users[0];
    // Переносим в blocked_users (с паролем и trainer_id)
    await connection.execute(
      'INSERT INTO blocked_users (user_id, username, email, password, reason, trainer_id) VALUES (?, ?, ?, ?, ?, ?)',
      [user.user_id, user.username, user.email, user.password, reason, user.trainer_id || null]
    );
    // Удаляем из users
    await connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера', error: e.message });
  } finally {
    await connection.end();
  }
} 