import type { NextApiRequest, NextApiResponse } from 'next';
import mysql from 'mysql2/promise';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  const { specialization, date } = req.query;
  if (!specialization || !date) {
    return res.status(400).json({ message: 'Необходимы specialization и date' });
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });

    const [rows] = await connection.execute(
      `SELECT booking_datetime FROM individual_bookings 
       WHERE specialization = ? AND DATE(booking_datetime) = ? AND status = 'active'`,
      [specialization, date]
    );

    // Возвращаем только startTime (часы и минуты)
    const busySlots = Array.isArray(rows)
      ? rows.map((row: any) => {
          const dt = new Date(row.booking_datetime);
          return dt.toISOString().slice(11, 16); // 'HH:MM'
        })
      : [];

    res.status(200).json({ busySlots });
  } catch (error) {
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    if (connection) await connection.end();
  }
} 