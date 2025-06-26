import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Метод не разрешен' });
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Не авторизован' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Недействительный токен' });
  }
  if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4', user: 'root', database: 'projectdiplom', password: ''
  });
  const [blocked] = await connection.execute('SELECT * FROM blocked_users');
  await connection.end();
  res.status(200).json(blocked);
} 