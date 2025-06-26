import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Заполните все поля' });
    }

    let connection;
    try {
      connection = await mysql.createConnection({
        host: "MySQL-8.4",
        user: "root",
        database: "projectdiplom",
        password: ""
      });

      // Поиск пользователя по email
      const [users] = await connection.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        // Проверяем, не заблокирован ли пользователь
        const [blocked] = await connection.execute(
          'SELECT * FROM blocked_users WHERE email = ?',
          [email]
        );
        if (blocked.length > 0) {
          return res.status(403).json({ blocked: true, reason: blocked[0].reason });
        }
        return res.status(401).json({ message: 'Неверные учетные данные' });
      }

      const user = users[0];
      
      // Сравнение паролей
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Неверные учетные данные' });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET не настроен');
      }

      // Генерация токена с использованием поля user_id и role
      const token = jwt.sign(
        { userId: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.status(200).json({
        userId: user.user_id,
        token,
        username: user.username,
        role: user.role
      });

    } catch (error) {
      console.error('Ошибка входа:', error);
      res.status(500).json({
        message: error.message || 'Внутренняя ошибка сервера',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    } finally {
      if (connection) await connection.end();
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ message: 'Метод не разрешен' });
  }
}