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
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ message: 'Не передан userId' });
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4', user: 'root', database: 'projectdiplom', password: ''
  });
  const [rows] = await connection.execute('SELECT trainer_id FROM users WHERE user_id = ?', [userId]);
  if (rows.length && rows[0].trainer_id) {
    await connection.execute('DELETE FROM trainers WHERE trainer_id = ?', [rows[0].trainer_id]);
  }
  await connection.execute('UPDATE users SET role = 3, trainer_id = NULL WHERE user_id = ?', [userId]);
  await connection.end();
  res.status(200).json({ success: true });
} 