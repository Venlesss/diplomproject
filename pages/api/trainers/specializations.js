import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Метод не разрешен' });
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });

    const [specializations] = await connection.execute(
      'SELECT DISTINCT specialization FROM trainers'
    );

    const specList = specializations.map(s => s.specialization).filter(s => s);
    res.status(200).json(specList);
  } catch (error) {
    console.error('Ошибка получения специализаций:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  } finally {
    if (connection) await connection.end();
  }
}