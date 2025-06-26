import mysql from 'mysql2/promise';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params; // id тренера
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: ''
    });
    const [rows] = await connection.execute(
      'SELECT id, type, date, start_date, end_date FROM trainer_days_off WHERE trainer_id = ?',
      [id]
    );
    return new Response(JSON.stringify(rows), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: 'Ошибка сервера', error: error.message }), { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  let connection;
  try {
    const body = await req.json();
    const { type, date, start_date, end_date, comment } = body;
    if (type === 'off') {
      if (!date) return new Response(JSON.stringify({ message: 'Не указана date' }), { status: 400 });
    } else if (type === 'vacation') {
      if (!start_date || !end_date) return new Response(JSON.stringify({ message: 'Не указан диапазон дат' }), { status: 400 });
    } else {
      return new Response(JSON.stringify({ message: 'Некорректный тип' }), { status: 400 });
    }
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: ''
    });
    if (type === 'off') {
      await connection.execute(
        'INSERT INTO trainer_days_off (trainer_id, type, date, comment) VALUES (?, ?, ?, ?)',
        [id, 'off', date, comment || null]
      );
    } else {
      await connection.execute(
        'INSERT INTO trainer_days_off (trainer_id, type, start_date, end_date, comment) VALUES (?, ?, ?, ?, ?)',
        [id, 'vacation', start_date, end_date, comment || null]
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: 'Ошибка сервера', error: error.message }), { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  let connection;
  try {
    const body = await req.json();
    const { type, date, start_date, end_date } = body;
    if (type === 'off') {
      if (!date) return new Response(JSON.stringify({ message: 'Не указана date' }), { status: 400 });
    } else if (type === 'vacation') {
      if (!start_date || !end_date) return new Response(JSON.stringify({ message: 'Не указан диапазон дат' }), { status: 400 });
    } else {
      return new Response(JSON.stringify({ message: 'Некорректный тип' }), { status: 400 });
    }
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: ''
    });
    if (type === 'off') {
      await connection.execute(
        'DELETE FROM trainer_days_off WHERE trainer_id = ? AND type = ? AND date = ?',
        [id, 'off', date]
      );
    } else {
      await connection.execute(
        'DELETE FROM trainer_days_off WHERE trainer_id = ? AND type = ? AND start_date = ? AND end_date = ?',
        [id, 'vacation', start_date, end_date]
      );
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ message: 'Ошибка сервера', error: error.message }), { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
} 