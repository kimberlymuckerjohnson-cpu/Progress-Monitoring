const { Pool } = require("pg");

// Create a connection pool using DATABASE_URL from Render environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Render Postgres
});

async function init() {
  // Teachers table: stores login accounts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  // Students table (we're not fully using DB for students yet, but it's safe to create it now)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      grade_level TEXT NOT NULL
    );
  `);

  // Goals table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      area TEXT NOT NULL,
      description TEXT NOT NULL,
      goal_grade_level TEXT NOT NULL,
      mastery_criteria TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE
    );
  `);

  // General assessments (overall assessment sessions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS general_assessments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      date DATE NOT NULL
    );
  `);

  // General assessment items (per question/task)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS general_assessment_items (
      id SERIAL PRIMARY KEY,
      assessment_id INTEGER REFERENCES general_assessments(id) ON DELETE CASCADE,
      goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      score TEXT NOT NULL
    );
  `);

  // Fluency assessments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS fluency_assessments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      total_words_attempted INTEGER NOT NULL,
      errors INTEGER NOT NULL,
      wcpm INTEGER NOT NULL,
      accuracy_percent REAL NOT NULL
    );
  `);
}

module.exports = { pool, init };
