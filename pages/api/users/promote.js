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
  const { userId, specialization, bio, first_name, last_name, photo_url } = req.body;
  if (!userId || !specialization || !bio || !first_name || !last_name) return res.status(400).json({ message: 'Не переданы все необходимые данные' });
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4', user: 'root', database: 'projectdiplom', password: ''
  });
  // 1. Добавляем тренера
  const [trainerResult] = await connection.execute(
    'INSERT INTO trainers (first_name, last_name, specialization, bio, user_id, photo_url) VALUES (?, ?, ?, ?, ?, ?)',
    [first_name, last_name, specialization, bio, userId, photo_url || null]
  );
  const trainer_id = trainerResult.insertId;
  // 2. Обновляем пользователя: роль и trainer_id
  await connection.execute('UPDATE users SET role = 2, trainer_id = ? WHERE user_id = ?', [trainer_id, userId]);
  await connection.end();
  res.status(200).json({ success: true, trainer_id });
} 