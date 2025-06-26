import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4',
    user: 'root',
    database: 'projectdiplom',
    password: '',
  });

  try {
    if (req.method === 'GET' && req.query.booking_id) {
      const [rows] = await connection.execute(
        'SELECT * FROM bookingssimple WHERE booking_id = ?',
        [req.query.booking_id]
      );
      await connection.end();
      return res.status(200).json(rows);
    }

    if (req.method === 'GET') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      let userId = decoded.userId;
      // Если админ и есть userId в query, используем его
      if (decoded.role === 1 && req.query && req.query.userId) {
        userId = req.query.userId;
      }

      // Удаляем просроченные абонементы
      await connection.execute(
        'DELETE FROM bookingssimple WHERE end_date IS NOT NULL AND end_date < NOW()'
      );

      const [bookings] = await connection.execute(
        `SELECT b.*, p.name, p.price, p.description 
         FROM bookingssimple b
         JOIN price_list p ON b.price_id = p.price_id
         WHERE b.user_id = ? AND b.status = 'active'
           AND (
             ((p.name LIKE '%8 посещений%' OR p.name LIKE '%Разовое посещение%') AND (b.visits_left IS NULL OR b.visits_left > 0))
             OR
             (p.name NOT LIKE '%8 посещений%' AND p.name NOT LIKE '%Разовое посещение%' AND (b.end_date IS NULL OR b.end_date >= NOW()))
           )
         ORDER BY b.created_at DESC`,
        [userId]
      );

      res.status(200).json(bookings);
    } else if (req.method === 'POST') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { priceId } = req.body;
      const userId = decoded.userId;

      // Проверяем существует ли такой прайс
      const [price] = await connection.execute(
        'SELECT * FROM price_list WHERE price_id = ?',
        [priceId]
      );

      if (price.length === 0) {
        return res.status(404).json({ message: 'Услуга не найдена' });
      }

      let endDate = null;
      let visitsLeft = null;
      const serviceName = price[0].name;

      if (serviceName.includes('8 посещений')) {
        visitsLeft = 8;
      } else if (serviceName.includes('Разовое посещение')) {
        visitsLeft = 1;
      } else if (serviceName.includes('1 месяц')) {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (serviceName.includes('3 месяца')) {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3);
      } else if (serviceName.includes('6 месяцев')) {
        endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 6);
      } else {
        endDate = new Date();
      }

      await connection.execute(
        'INSERT INTO bookingssimple (user_id, price_id, booking_date, end_date, status, visits_left) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, priceId, new Date(), endDate, 'active', visitsLeft]
      );

      // Получаем только что созданный booking_id
      const [rows] = await connection.execute(
        'SELECT booking_id FROM bookingssimple WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId]
      );
      const bookingId = rows[0]?.booking_id;

      // Получаем сумму
      const amount = price[0].price;

      // Создаём чек через receipts API
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            ticket_type: 'simple',
            ticket_id: bookingId,
            user_id: userId,
            amount
          })
        });
      } catch (e) {
        // Не критично, если чек не создался
        console.error('Ошибка создания чека:', e);
      }

      res.status(201).json({ success: true });
    } else if (req.method === 'DELETE') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      const { booking_id } = req.body;
      if (!booking_id) return res.status(400).json({ message: 'Не передан booking_id' });
      // Проверяем, что бронирование принадлежит пользователю
      const [rows] = await connection.execute(
        'SELECT * FROM bookingssimple WHERE booking_id = ? AND user_id = ?',
        [booking_id, userId]
      );
      if (!rows || rows.length === 0) {
        return res.status(404).json({ message: 'Бронирование не найдено' });
      }
      await connection.execute(
        'DELETE FROM bookingssimple WHERE booking_id = ? AND user_id = ?',
        [booking_id, userId]
      );
      res.status(200).json({ success: true });
    } else if (req.method === 'PATCH') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });

      const { booking_id, visits_left } = req.body;
      if (!booking_id || typeof visits_left !== 'number') {
        return res.status(400).json({ message: 'booking_id и visits_left обязательны' });
      }

      if (visits_left === 0) {
        await connection.execute(
          'DELETE FROM bookingssimple WHERE booking_id = ?',
          [booking_id]
        );
        return res.status(200).json({ success: true, deleted: true });
      } else {
        await connection.execute(
          'UPDATE bookingssimple SET visits_left = ? WHERE booking_id = ?',
          [visits_left, booking_id]
        );
        return res.status(200).json({ success: true });
      }
    } else {
      res.status(405).json({ message: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    await connection.end();
  }
}