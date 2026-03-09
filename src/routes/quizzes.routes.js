import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import db from '../config/database.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import {
  quizCreateSchema,
  quizUpdateSchema,
  questionCreateSchema,
  questionUpdateSchema,
  quizSubmitSchema
} from '../schemas/course.schema.js';
import { wrap } from '../middleware/error-handler.js';

const router = Router();

async function courseOwnershipByQuiz(quizId) {
  const [rows] = await db.query(
    `SELECT c.user_id, c.is_published, q.course_id
     FROM course_quizzes q JOIN courses c ON c.id = q.course_id
     WHERE q.id = ?`,
    [quizId]
  );
  return rows[0];
}

router.get('/courses/:id/quizzes', optionalAuth, wrap(async (req, res) => {
  const { id } = req.params;
  const [courseRows] = await db.query('SELECT user_id, is_published FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });

  const isOwner = req.user && course.user_id === req.user.id;
  if (!course.is_published && !isOwner) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const { lesson_id } = req.query;
  let sql = 'SELECT * FROM course_quizzes WHERE course_id = ?';
  const params = [id];

  if (lesson_id === 'null' || lesson_id === null) {
    sql += ' AND lesson_id IS NULL';
  } else if (lesson_id) {
    sql += ' AND lesson_id = ?';
    params.push(lesson_id);
  }

  sql += ' ORDER BY sort_order ASC';
  const [rows] = await db.query(sql, params);
  res.json(rows);
}));

router.post('/courses/:id/quizzes', authMiddleware, validateBody(quizCreateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const [courseRows] = await db.query('SELECT user_id FROM courses WHERE id = ?', [id]);
  const course = courseRows[0];
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'NOT_FOUND' });
  if (course.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const quizId = uuid();
  await db.query(
    `INSERT INTO course_quizzes (id, course_id, lesson_id, title, description, passing_score, is_required, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      quizId,
      id,
      data.lesson_id || null,
      data.title,
      data.description || null,
      data.passing_score ?? 70,
      data.is_required ?? false,
      data.sort_order ?? 0
    ]
  );

  const [rows] = await db.query('SELECT * FROM course_quizzes WHERE id = ?', [quizId]);
  res.status(201).json(rows[0]);
}));

router.patch('/quizzes/:id', authMiddleware, validateBody(quizUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const ownership = await courseOwnershipByQuiz(id);
  if (!ownership) return res.status(404).json({ error: 'Quiz not found', code: 'NOT_FOUND' });
  if (ownership.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE course_quizzes SET ${fields.join(', ')} WHERE id = ?`, values);
  const [rows] = await db.query('SELECT * FROM course_quizzes WHERE id = ?', [id]);
  res.json(rows[0]);
}));

router.delete('/quizzes/:id', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const ownership = await courseOwnershipByQuiz(id);
  if (!ownership) return res.status(404).json({ error: 'Quiz not found', code: 'NOT_FOUND' });
  if (ownership.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  await db.query('DELETE FROM course_quizzes WHERE id = ?', [id]);
  res.json({ message: 'Quiz deleted' });
}));

router.get('/quizzes/:id/questions', optionalAuth, wrap(async (req, res) => {
  const { id } = req.params;
  const ownership = await courseOwnershipByQuiz(id);
  if (!ownership) return res.status(404).json({ error: 'Quiz not found', code: 'NOT_FOUND' });

  const isOwner = req.user && ownership.user_id === req.user.id;
  if (!ownership.is_published && !isOwner) {
    return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
  }

  const [rows] = await db.query('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC', [id]);
  res.json(rows);
}));

router.post('/quizzes/:id/questions', authMiddleware, validateBody(questionCreateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const ownership = await courseOwnershipByQuiz(id);
  if (!ownership) return res.status(404).json({ error: 'Quiz not found', code: 'NOT_FOUND' });
  if (ownership.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const data = req.body;
  const questionId = uuid();
  await db.query(
    `INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, options, correct_answer, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)` ,
    [
      questionId,
      id,
      data.question_text,
      data.question_type || 'multiple_choice',
      JSON.stringify(data.options || []),
      data.correct_answer,
      data.sort_order ?? 0
    ]
  );

  const [rows] = await db.query('SELECT * FROM quiz_questions WHERE id = ?', [questionId]);
  res.status(201).json(rows[0]);
}));

router.patch('/questions/:id', authMiddleware, validateBody(questionUpdateSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT qz.id AS quiz_id, c.user_id
     FROM quiz_questions qq
     JOIN course_quizzes qz ON qz.id = qq.quiz_id
     JOIN courses c ON c.id = qz.course_id
     WHERE qq.id = ?`,
    [id]
  );
  const ownership = rows[0];
  if (!ownership) return res.status(404).json({ error: 'Question not found', code: 'NOT_FOUND' });
  if (ownership.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  const updates = req.body;
  const fields = [];
  const values = [];
  for (const key of Object.keys(updates)) {
    fields.push(`${key} = ?`);
    const val = key === 'options' ? JSON.stringify(updates[key]) : updates[key];
    values.push(val);
  }
  if (fields.length === 0) return res.json({ message: 'No changes' });

  values.push(id);
  await db.query(`UPDATE quiz_questions SET ${fields.join(', ')} WHERE id = ?`, values);
  const [updated] = await db.query('SELECT * FROM quiz_questions WHERE id = ?', [id]);
  res.json(updated[0]);
}));

router.delete('/questions/:id', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    `SELECT c.user_id
     FROM quiz_questions qq
     JOIN course_quizzes qz ON qz.id = qq.quiz_id
     JOIN courses c ON c.id = qz.course_id
     WHERE qq.id = ?`,
    [id]
  );
  const ownership = rows[0];
  if (!ownership) return res.status(404).json({ error: 'Question not found', code: 'NOT_FOUND' });
  if (ownership.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });

  await db.query('DELETE FROM quiz_questions WHERE id = ?', [id]);
  res.json({ message: 'Question deleted' });
}));

router.post('/quizzes/:id/submit', authMiddleware, validateBody(quizSubmitSchema), wrap(async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body;

  const [quizRows] = await db.query('SELECT * FROM course_quizzes WHERE id = ?', [id]);
  const quiz = quizRows[0];
  if (!quiz) return res.status(404).json({ error: 'Quiz not found', code: 'NOT_FOUND' });

  const [questionsRows] = await db.query('SELECT * FROM quiz_questions WHERE quiz_id = ?', [id]);
  const questions = questionsRows;

  let correct = 0;
  for (const q of questions) {
    if (answers[q.id] && answers[q.id] === q.correct_answer) correct++;
  }

  const total = questions.length || 1;
  const score = Math.round((correct / total) * 100);
  const passed = score >= (quiz.passing_score || 70);

  const attemptId = uuid();
  await db.query(
    `INSERT INTO quiz_attempts (id, quiz_id, student_id, score, passed, answers)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [attemptId, id, req.user.id, score, passed, JSON.stringify(answers || {})]
  );

  res.json({
    score,
    passed,
    passing_score: quiz.passing_score || 70,
    correct_answers: correct,
    total_questions: questions.length
  });
}));

router.get('/quizzes/:id/attempts', authMiddleware, wrap(async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query(
    'SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ? ORDER BY completed_at DESC',
    [id, req.user.id]
  );
  res.json(rows);
}));

export default router;
