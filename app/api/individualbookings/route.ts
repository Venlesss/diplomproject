import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

export async function GET(req: NextRequest) {
  let connection;
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Не авторизован' }, { status: 401 });
    }

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ message: 'JWT_SECRET не настроен' }, { status: 500 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string, role: number };
    let userId = decoded.userId;
    // Если админ и есть userId в query, используем его
    const url = req.nextUrl;
    const userIdParam = url.searchParams.get('userId');
    if (decoded.role === 1 && userIdParam) {
      userId = userIdParam;
    }

    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });

    // Новый режим: если ?asTrainer=1, то ищем записи, где тренер — текущий пользователь
    const asTrainer = url.searchParams.get('asTrainer') === '1';
    if (asTrainer) {
      // Получаем trainer_id для этого user_id
      const [trainerRows] = await connection.execute(
        'SELECT trainer_id FROM users WHERE user_id = ? AND role = 2',
        [userId]
      );
      const trainerRowsArr = trainerRows as any[];
      console.log('userId (из токена):', userId);
      if (!trainerRowsArr.length) {
        console.log('Нет trainer_id для userId', userId);
        return NextResponse.json([], { status: 200 });
      }
      const trainerId = trainerRowsArr[0].trainer_id;
      console.log('trainerId (из users):', trainerId);
      if (!trainerId) {
        console.log('trainerId пустой для userId', userId);
        return NextResponse.json([], { status: 200 });
      }
      const [bookings] = await connection.execute(
        `SELECT 
          ib.booking_id,
          ib.booking_datetime,
          ib.status,
          ib.specialization,
          u.username as user_name
        FROM individual_bookings ib
        JOIN users u ON ib.user_id = u.user_id
        WHERE ib.trainer_id = ? AND ib.status = 'active'`,
        [trainerId]
      );
      return NextResponse.json(bookings);
    }

    const [bookings] = await connection.execute(
      `SELECT 
        ib.booking_id,
        ib.booking_datetime,
        ib.status,
        ib.specialization,
        t.first_name,
        t.last_name,
        p.name as service_name,
        p.price as service_price
      FROM individual_bookings ib
      JOIN trainers t ON ib.trainer_id = t.trainer_id
      LEFT JOIN price_list p ON ib.price_id = p.price_id
      WHERE ib.user_id = ?`,
      [userId]
    );

    return NextResponse.json(bookings);
  } catch (error: any) {
    console.error('Ошибка:', error);
    return NextResponse.json(
      { message: 'Ошибка сервера', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}

export async function PATCH(req: NextRequest) {
  let connection;
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Не авторизован' }, { status: 401 });
    }
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ message: 'JWT_SECRET не настроен' }, { status: 500 });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    const userId = decoded.userId;
    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) {
      return NextResponse.json({ message: 'Не передан booking_id' }, { status: 400 });
    }
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });
    // Проверяем, что бронирование принадлежит пользователю и активно
    const [rows]: any = await connection.execute(
      'SELECT * FROM individual_bookings WHERE booking_id = ? AND user_id = ? AND status = "active"',
      [booking_id, userId]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: 'Бронирование не найдено или уже отменено' }, { status: 404 });
    }
    await connection.execute(
      'UPDATE individual_bookings SET status = "cancelled" WHERE booking_id = ? AND user_id = ?',
      [booking_id, userId]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Ошибка отмены бронирования:', error);
    return NextResponse.json(
      { message: 'Ошибка сервера', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}

export async function DELETE(req: NextRequest) {
  let connection;
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ message: 'Не авторизован' }, { status: 401 });
    }
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ message: 'JWT_SECRET не настроен' }, { status: 500 });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string, role: number };
    const userId = decoded.userId;
    const role = decoded.role;
    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) {
      return NextResponse.json({ message: 'Не передан booking_id' }, { status: 400 });
    }
    connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });

    let rows: any;
    if (role === 1) {
      // Админ может удалить любую запись
      [rows] = await connection.execute(
        'SELECT * FROM individual_bookings WHERE booking_id = ?',
        [booking_id]
      );
    } else {
      // Обычный пользователь — только свою
      [rows] = await connection.execute(
        'SELECT * FROM individual_bookings WHERE booking_id = ? AND user_id = ?',
        [booking_id, userId]
      );
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: 'Бронирование не найдено' }, { status: 404 });
    }
    await connection.execute(
      'DELETE FROM individual_bookings WHERE booking_id = ?',
      [booking_id]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Ошибка удаления бронирования:', error);
    return NextResponse.json(
      { message: 'Ошибка сервера', error: error.message },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}