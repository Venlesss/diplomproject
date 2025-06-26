import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { username, email, password } = req.body;
    const saltRounds = 10;

    const connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });

    try {
      // Проверка существующего email
      const [existing] = await connection.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({ message: 'Email уже зарегистрирован' });
      }

      // Хеширование пароля
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const [result] = await connection.execute(
        'INSERT INTO users (username, email, password, role, trainer_id) VALUES (?, ?, ?, 3, NULL)',
        [username, email, hashedPassword]
      );

      // Генерируем токен сразу после регистрации
      const token = jwt.sign(
        { userId: result.insertId, role: 3 },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      res.status(201).json({ userId: result.insertId, token, username, role: 3 });
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
      await connection.end();
    }
  } else {
    res.status(405).json({ message: 'Метод не разрешен' });
  }
}