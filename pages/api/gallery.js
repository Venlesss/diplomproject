import mysql from 'mysql2/promise';
import { IncomingForm } from 'formidable';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });
    try {
      const [images] = await connection.execute('SELECT * FROM gallery_images ORDER BY uploaded_at DESC');
      res.status(200).json(images);
    } catch (error) {
      console.error('Ошибка работы с галереей:', error);
      res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
      await connection.end();
    }
  } else if (req.method === 'POST') {
    // Проверка авторизации и роли
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Не авторизован' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Недействительный токен' });
    }
    if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
    const form = new IncomingForm();
    form.uploadDir = path.join(process.cwd(), 'public/images/gallery');
    form.keepExtensions = true;
    form.maxFileSize = 10 * 1024 * 1024;
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ message: 'Ошибка загрузки файла' });
      let file = files.file;
      if (Array.isArray(file)) file = file[0];
      if (!file) return res.status(400).json({ message: 'Файл не найден' });
      const filePath = file.filepath || file.path || file.newFilename || file.originalFilename;
      if (!filePath || typeof filePath !== 'string') {
        return res.status(500).json({ message: 'Ошибка: не удалось определить путь к файлу' });
      }
      const fileName = path.basename(filePath);
      const url = `/images/gallery/${fileName}`;
      // Описание: убираем массивы и кавычки
      let description = fields.description || '';
      if (Array.isArray(description)) description = description[0];
      if (typeof description !== 'string') description = String(description);
      if (description.startsWith('[') && description.endsWith(']')) {
        try {
          const parsed = JSON.parse(description);
          if (typeof parsed === 'string') description = parsed;
        } catch {}
      }
      // Открываем соединение здесь!
      const connection = await mysql.createConnection({
        host: 'MySQL-8.4',
        user: 'root',
        database: 'projectdiplom',
        password: '',
      });
      await connection.execute(
        'INSERT INTO gallery_images (image_url, description) VALUES (?, ?)',
        [url, description]
      );
      await connection.end();
      return res.status(201).json({ url });
    });
  } else if (req.method === 'DELETE') {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Не авторизован' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Недействительный токен' });
    }
    if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
    const { image_id } = req.query;
    if (!image_id) return res.status(400).json({ message: 'Не передан image_id' });
    const connection = await mysql.createConnection({
      host: 'MySQL-8.4',
      user: 'root',
      database: 'projectdiplom',
      password: '',
    });
    try {
      // Получаем url для удаления файла
      const [rows] = await connection.execute('SELECT image_url FROM gallery_images WHERE image_id = ?', [image_id]);
      if (rows.length && rows[0].image_url) {
        const filePath = path.join(process.cwd(), 'public', rows[0].image_url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      await connection.execute('DELETE FROM gallery_images WHERE image_id = ?', [image_id]);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Ошибка удаления из галереи:', error);
      res.status(500).json({ message: 'Ошибка сервера' });
    } finally {
      await connection.end();
    }
  } else if (req.method === 'PATCH') {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Не авторизован' });
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Недействительный токен' });
    }
    if (decoded.role !== 1) return res.status(403).json({ message: 'Нет доступа' });
    const form = new IncomingForm();
    form.uploadDir = path.join(process.cwd(), 'public/images/gallery');
    form.keepExtensions = true;
    form.maxFileSize = 10 * 1024 * 1024;
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ message: 'Ошибка загрузки файла' });
      const { image_id } = fields;
      // Описание: убираем массивы и кавычки
      let description = fields.description || '';
      if (Array.isArray(description)) description = description[0];
      if (typeof description !== 'string') description = String(description);
      if (description.startsWith('[') && description.endsWith(']')) {
        try {
          const parsed = JSON.parse(description);
          if (typeof parsed === 'string') description = parsed;
        } catch {}
      }
      if (!image_id) return res.status(400).json({ message: 'Не передан image_id' });
      let url = null;
      if (files.file) {
        let file = files.file;
        if (Array.isArray(file)) file = file[0];
        const filePath = file.filepath || file.path || file.newFilename || file.originalFilename;
        if (!filePath || typeof filePath !== 'string') {
          return res.status(500).json({ message: 'Ошибка: не удалось определить путь к файлу' });
        }
        const fileName = path.basename(filePath);
        url = `/images/gallery/${fileName}`;
      }
      // Открываем соединение здесь!
      const connection = await mysql.createConnection({
        host: 'MySQL-8.4',
        user: 'root',
        database: 'projectdiplom',
        password: '',
      });
      if (url) {
        // Удаляем старое фото
        const [rows] = await connection.execute('SELECT image_url FROM gallery_images WHERE image_id = ?', [image_id]);
        if (rows.length && rows[0].image_url) {
          const oldPath = path.join(process.cwd(), 'public', rows[0].image_url);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        await connection.execute('UPDATE gallery_images SET image_url = ?, description = ? WHERE image_id = ?', [url, description || '', image_id]);
      } else {
        await connection.execute('UPDATE gallery_images SET description = ? WHERE image_id = ?', [description || '', image_id]);
      }
      await connection.end();
      return res.status(200).json({ success: true, url });
    });
  } else {
    res.status(405).json({ message: 'Метод не разрешен' });
  }
} 