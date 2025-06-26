import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4',
    user: 'root',
    database: 'projectdiplom',
    password: '',
  });

  try {
    if (req.method === 'GET') {
      const [news] = await connection.execute(
        'SELECT news_id, title, content, date FROM news ORDER BY date DESC, news_id DESC'
      );
      res.status(200).json(news);
    } else if (req.method === 'POST') {
      // Проверка авторизации и роли
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Недействительный токен' });
      }
      if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
      const { title, content, date } = req.body;
      if (!title || !content) return res.status(400).json({ message: 'Не переданы все необходимые данные' });
      await connection.execute(
        'INSERT INTO news (title, content, date) VALUES (?, ?, ?)',
        [title, content, date || new Date()]
      );
      res.status(201).json({ success: true });
    } else if (req.method === 'DELETE') {
      // Проверка авторизации и роли
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Недействительный токен' });
      }
      if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
      const newsId = req.query.id;
      if (!newsId) return res.status(400).json({ message: 'Не передан id новости' });
      await connection.execute('DELETE FROM news WHERE news_id = ?', [newsId]);
      res.status(200).json({ success: true });
    } else {
      res.status(405).json({ message: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Ошибка работы с новостями:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    await connection.end();
  }
} 