import { IncomingForm } from 'formidable';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Метод не разрешен' });
  const form = new IncomingForm();
  form.uploadDir = path.join(process.cwd(), 'public/images/trainers');
  form.keepExtensions = true;
  form.maxFileSize = 5 * 1024 * 1024; // 5MB

  form.parse(req, (err, fields, files) => {
    if (err) return res.status(500).json({ message: 'Ошибка загрузки файла' });

    let file = files.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) return res.status(400).json({ message: 'Файл не найден' });

    // В новых версиях formidable путь к файлу — file.filepath
    const filePath = file.filepath || file.path || file.newFilename || file.originalFilename;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(500).json({ message: 'Ошибка: не удалось определить путь к файлу' });
    }
    const fileName = path.basename(filePath);
    const url = `/images/trainers/${fileName}`;
    return res.status(200).json({ url });
  });
} 