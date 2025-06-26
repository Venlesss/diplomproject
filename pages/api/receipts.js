import mysql from 'mysql2/promise';

function generateReceiptNumber(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Без I, O, 1, 0
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const STATUS_RU = {
  paid: 'Оплачен',
  pending: 'Ожидает оплаты',
  expired: 'Просрочен',
};

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: 'MySQL-8.4',
    user: 'root',
    database: 'projectdiplom',
    password: ''
  });

  // Новый обработчик: получить чек по ticket_id и ticket_type
  if (req.method === 'GET' && req.query.ticket_id && req.query.ticket_type) {
    const [rows] = await connection.execute(
      'SELECT * FROM receipts WHERE ticket_id = ? AND ticket_type = ? ORDER BY created_at DESC LIMIT 1',
      [req.query.ticket_id, req.query.ticket_type]
    );
    await connection.end();
    if (!rows.length) return res.status(404).json({});
    return res.json(rows[0]);
  }

  if (req.method === 'POST' && req.body.action === 'create') {
    // Создание чека
    const { ticket_type, ticket_id, user_id, amount } = req.body;
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    const receipt_number = generateReceiptNumber(8);
    const [result] = await connection.execute(
      'INSERT INTO receipts (ticket_type, ticket_id, user_id, amount, expires_at, receipt_number) VALUES (?, ?, ?, ?, ?, ?)',
      [ticket_type, ticket_id, user_id, amount, expires_at, receipt_number]
    );
    const [rows] = await connection.execute('SELECT * FROM receipts WHERE receipt_id = ?', [result.insertId]);
    await connection.end();
    return res.status(201).json(rows[0]);
  }

  if (req.method === 'POST' && req.body.action === 'pay') {
    // Оплата чека
    const { receipt_id } = req.body;
    const [rows] = await connection.execute('SELECT * FROM receipts WHERE receipt_id = ?', [receipt_id]);
    if (!rows.length || rows[0].status !== 'pending') {
      await connection.end();
      return res.status(400).json({ error: 'Чек не найден или уже оплачен' });
    }
    await connection.execute('UPDATE receipts SET status = ?, paid_at = ? WHERE receipt_id = ?', ['paid', new Date(), receipt_id]);
    await connection.end();
    return res.json({ success: true });
  }

  if (req.method === 'GET' && req.query.number) {
    // Получить чек по номеру с расширенной информацией
    const [rows] = await connection.execute('SELECT * FROM receipts WHERE receipt_number = ?', [req.query.number]);
    if (!rows.length) {
      await connection.end();
      return res.status(404).json({ error: 'Чек не найден' });
    }
    const receipt = rows[0];
    let extra = {};
    if (receipt.ticket_type === 'simple') {
      // Получить название услуги, даты, посещения, имя и почту пользователя
      const [[user]] = await connection.execute('SELECT username, email FROM users WHERE user_id = ?', [receipt.user_id]);
      const [[booking]] = await connection.execute('SELECT * FROM bookingssimple WHERE booking_id = ?', [receipt.ticket_id]);
      const [[price]] = await connection.execute('SELECT name FROM price_list WHERE price_id = ?', [booking.price_id]);
      extra = {
        user_name: user?.username || '',
        user_email: user?.email || '',
        service_name: price?.name || '',
        visits_left: booking?.visits_left,
        booking_date: booking?.booking_date,
        end_date: booking?.end_date,
      };
    } else if (receipt.ticket_type === 'individual') {
      // Получить имя и почту пользователя, имя и фамилию тренера, специализацию
      const [[user]] = await connection.execute('SELECT username, email FROM users WHERE user_id = ?', [receipt.user_id]);
      const [[booking]] = await connection.execute('SELECT * FROM individual_bookings WHERE booking_id = ?', [receipt.ticket_id]);
      const [[trainer]] = await connection.execute('SELECT first_name, last_name FROM trainers WHERE trainer_id = ?', [booking.trainer_id]);
      extra = {
        user_name: user?.username || '',
        user_email: user?.email || '',
        trainer_name: trainer ? `${trainer.first_name} ${trainer.last_name}` : '',
        specialization: booking?.specialization || '',
      };
    }
    await connection.end();
    return res.json({
      ...receipt,
      status_ru: STATUS_RU[receipt.status] || receipt.status,
      ...extra,
    });
  }

  if (req.method === 'DELETE' && req.query.expired === '1') {
    // Удалить просроченные чеки и связанные тикеты
    const [expired] = await connection.execute('SELECT * FROM receipts WHERE status = ? AND expires_at < NOW()', ['pending']);
    for (const receipt of expired) {
      if (receipt.ticket_type === 'individual') {
        await connection.execute('DELETE FROM individual_bookings WHERE booking_id = ?', [receipt.ticket_id]);
      } else {
        await connection.execute('DELETE FROM bookingssimple WHERE booking_id = ?', [receipt.ticket_id]);
      }
      await connection.execute('DELETE FROM receipts WHERE receipt_id = ?', [receipt.receipt_id]);
    }
    await connection.end();
    return res.json({ deleted: expired.length });
  }

  await connection.end();
  return res.status(405).json({ error: 'Метод не поддерживается' });
} 