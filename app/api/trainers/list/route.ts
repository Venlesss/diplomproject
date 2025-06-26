import mysql from 'mysql2/promise';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: 'MySQL-8.4', // Проверьте название хоста!
      user: 'root',
      database: 'projectdiplom',
      password: ''
    });

    // Получаем specialization из query
    let specialization = undefined;
    if (req && req.url) {
      const url = new URL(req.url, 'http://localhost');
      specialization = url.searchParams.get('specialization');
    }

    let trainers;
    if (specialization) {
      // Фильтрация по точному совпадению
      [trainers] = await connection.execute(
        `SELECT trainer_id, first_name, last_name, specialization, bio, photo_url 
         FROM trainers WHERE specialization = ?`,
        [specialization]
      );
    } else {
      [trainers] = await connection.execute(
        `SELECT trainer_id, first_name, last_name, specialization, bio, photo_url 
         FROM trainers`
      );
    }

    return new Response(JSON.stringify(trainers), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      message: 'Ошибка сервера',
      error: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally {
    if (connection) await connection.end();
  }
}