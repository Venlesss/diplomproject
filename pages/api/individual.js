import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Получаем trainer_id из query или из токена
    let trainerId = req.query.trainerId;
    if (!trainerId) {
      // Пробуем получить из токена (если тренер авторизован)
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'Не авторизован' });
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        trainerId = decoded.trainerId;
      } catch {
        return res.status(401).json({ message: 'Недействительный токен' });
      }
    }
    if (!trainerId) return res.status(400).json({ message: 'Не передан trainerId' });
    let connection;
    try {
      connection = await mysql.createConnection({
        host: 'MySQL-8.4',
        user: 'root',
        database: 'projectdiplom',
        password: '',
      });
      const [bookings] = await connection.execute(
        'SELECT * FROM individual_bookings WHERE trainer_id = ? AND status = "active" ORDER BY booking_datetime ASC',
        [trainerId]
      );
      return res.status(200).json(bookings);
    } catch (error) {
      console.error('Ошибка получения броней тренера:', error);
      return res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
      if (connection) await connection.end();
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Не авторизован' });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.userId;
  } catch (error) {
    return res.status(401).json({ message: 'Недействительный токен' });
  }

  const { trainerId, specialization, bookingDateTime } = req.body;

  if (!trainerId || !specialization || !bookingDateTime) {
    return res.status(400).json({ message: 'Необходимы все поля (включая trainerId и specialization)' });
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });

    const [trainer] = await connection.execute(
      'SELECT * FROM trainers WHERE trainer_id = ?',
      [trainerId]
    );

    if (trainer.length === 0) {
      return res.status(404).json({ message: 'Тренер не найден' });
    }

    // Проверка на занятость времени и специализации
    // Получаем дату и время начала и конца слота
    const startTime = bookingDateTime.split('T')[1].slice(0,5); // '11:00'
    // Предполагаем, что слот всегда 2 часа (как в UI)
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const endHour = startHour + 2;
    const endTime = `${endHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    // Ищем пересекающиеся бронирования по специализации и дате
    const [conflicts] = await connection.execute(
      `SELECT * FROM individual_bookings 
       WHERE specialization = ? 
         AND DATE(booking_datetime) = ?
         AND status = 'active'
         AND (
           (TIME(booking_datetime) < ? AND TIME(booking_datetime) >= ?)
           OR (TIME(booking_datetime) >= ? AND TIME(booking_datetime) < ?)
           OR (TIME(booking_datetime) = ?)
         )
      `,
      [specialization, bookingDateTime.split('T')[0], endTime, startTime, startTime, endTime, startTime]
    );

    if (conflicts.length > 0) {
      return res.status(409).json({ message: 'Это время уже занято для выбранной услуги. Пожалуйста, выберите другое время.' });
    }

    // Получаем price_id для услуги "Тренировка + посещение"
    const [priceRow] = await connection.execute(
      'SELECT price_id FROM price_list WHERE name = ? LIMIT 1',
      ['Тренировка + посещение']
    );
    if (!priceRow || priceRow.length === 0) {
      return res.status(500).json({ message: 'Не найдена цена для услуги "Тренировка + посещение"' });
    }
    const priceId = priceRow[0].price_id;

    const [result] = await connection.execute(
      `INSERT INTO individual_bookings (user_id, trainer_id, specialization, booking_datetime, status, price_id) 
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [userId, trainerId, specialization, bookingDateTime, priceId]
    );
    const bookingId = result.insertId;
    // Получаем цену услуги
    const [priceData] = await connection.execute('SELECT price FROM price_list WHERE price_id = ?', [priceId]);
    const amount = priceData && priceData[0] ? priceData[0].price : null;
    // Создаём чек через receipts API
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/receipts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ticket_type: 'individual',
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
  } catch (error) {
    console.error('Ошибка создания бронирования:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    if (connection) await connection.end();
  }
}
