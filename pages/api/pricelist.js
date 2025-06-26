import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4',
    user: 'root',
    database: 'projectdiplom',
    password: '',
  });

  try {
    if (req.method === 'GET') {
      const [prices] = await connection.execute(
        'SELECT * FROM price_list'
      );
      res.status(200).json(prices);
    } else if (req.method === 'PUT') {
      // Проверка авторизации и роли
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });
      let decoded;
      try {
        decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Недействительный токен' });
      }
      if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
      const prices = req.body;
      if (!Array.isArray(prices)) return res.status(400).json({ message: 'Некорректные данные' });
      for (const item of prices) {
        await connection.execute(
          'UPDATE price_list SET name = ?, price = ?, description = ? WHERE price_id = ?',
          [item.name, item.price, item.description, item.price_id]
        );
      }
      return res.status(200).json({ success: true });
    } else {
      res.status(405).json({ message: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Ошибка получения прайс-листа:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    await connection.end();
  }
}