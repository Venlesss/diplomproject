import mysql from "mysql2/promise";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: "MySQL-8.4",
    user: "root",
    database: "projectdiplom",
    password: "",
  });

  try {
    if (req.method === "GET") {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ message: "Не авторизован" });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;

      const [bookings] = await connection.execute(
        `SELECT 
          b.booking_id,
          b.booking_date,
          b.status,
          t.first_name,
          t.last_name,
          s.activity,
          s.day_of_week,
          s.start_time,
          s.end_time
        FROM bookings b
        JOIN schedules s ON b.schedule_id = s.schedule_id
        JOIN trainers t ON b.trainer_id = t.trainer_id
        WHERE b.user_id = ?
        ORDER BY b.created_at DESC`,
        [userId]
      );

      res.status(200).json(bookings);
    } else if (req.method === "POST") {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) return res.status(401).json({ message: "Не авторизован" });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { userId, scheduleId } = req.body;

      if (decoded.userId !== userId) {
        return res.status(403).json({ message: "Пользователь не соответствует" });
      }

      const [rows] = await connection.execute(
        "SELECT trainer_id FROM schedules WHERE schedule_id = ?",
        [scheduleId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ message: "Расписание не найдено" });
      }

      const trainerId = rows[0].trainer_id;
      const bookingDate = new Date();
      const status = "pending";
      const createdAt = new Date();

      await connection.execute(
        "INSERT INTO bookings (user_id, schedule_id, trainer_id, booking_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, scheduleId, trainerId, bookingDate, status, createdAt]
      );

      res.status(201).json({ success: true });
    } else {
      res.status(405).json({ message: "Метод не разрешен" });
    }
  } catch (error) {
    console.error("Ошибка:", error);
    res.status(500).json({ message: "Ошибка сервера" });
  } finally {
    await connection.end();
  }
}