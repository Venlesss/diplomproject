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
      // Получаем данные тренеров и их расписание через JOIN с учетом реальных названий полей
      const [trainers] = await connection.execute(
        `SELECT 
           t.trainer_id, 
           t.first_name, 
           t.last_name, 
           t.specialization, 
           t.bio,
           t.photo_url,
           s.schedule_id, 
           s.day_of_week, 
           s.start_time, 
           s.end_time,
           s.activity
         FROM trainers t
         JOIN schedules s ON t.trainer_id = s.trainer_id`
      );
      res.status(200).json(trainers);
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
      const trainers = req.body;
      if (!Array.isArray(trainers)) return res.status(400).json({ message: 'Некорректные данные' });
      for (const t of trainers) {
        await connection.execute(
          'UPDATE trainers SET specialization = ?, bio = ?, photo_url = ? WHERE trainer_id = ?',
          [t.specialization, t.bio, t.photo_url, t.trainer_id]
        );
      }
      return res.status(200).json({ success: true });
    } else if (req.method === 'POST') {
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
      const { first_name, last_name, specialization, bio, photo_url } = req.body;
      if (!first_name || !last_name || !specialization || !bio) return res.status(400).json({ message: 'Не переданы все необходимые данные' });
      const [result] = await connection.execute(
        'INSERT INTO trainers (first_name, last_name, specialization, bio, photo_url) VALUES (?, ?, ?, ?, ?)',
        [first_name, last_name, specialization, bio, photo_url || null]
      );
      return res.status(201).json({ trainer_id: result.insertId });
    } else if (req.method === 'PATCH') {
      // Удалено: обновление лимитов тренера
      res.status(405).json({ message: 'Метод не разрешен' });
    } else {
      res.status(405).json({ message: 'Метод не разрешен' });
    }
  } catch (error) {
    console.error('Ошибка получения/обновления тренеров:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    await connection.end();
  }
}