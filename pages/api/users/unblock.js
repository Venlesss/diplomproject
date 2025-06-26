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
  const { blockedId } = req.body;
  if (!blockedId) return res.status(400).json({ message: 'Не передан blockedId' });
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4', user: 'root', database: 'projectdiplom', password: ''
  });
  try {
    // Получаем заблокированного пользователя
    const [blocked] = await connection.execute('SELECT * FROM blocked_users WHERE blocked_id = ?', [blockedId]);
    if (blocked.length === 0) return res.status(404).json({ message: 'Пользователь не найден' });
    const user = blocked[0];
    // Вставляем обратно в users (с паролем и trainer_id)
    if (user.trainer_id) {
      await connection.execute(
        'INSERT INTO users (username, email, password, role, trainer_id) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.email, user.password, user.role || 3, user.trainer_id]
      );
    } else {
      await connection.execute(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [user.username, user.email, user.password, user.role || 3]
      );
    }
    // Удаляем из blocked_users
    await connection.execute('DELETE FROM blocked_users WHERE blocked_id = ?', [blockedId]);
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Ошибка сервера', error: e.message });
  } finally {
    await connection.end();
  }
} 