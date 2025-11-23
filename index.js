const express = require("express");
const path = require("path");
const layouts = require("express-ejs-layouts");

const app = express();

// ================================
// BASIC APP SETUP
// ================================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout");

app.use(layouts);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ================================
// IN-MEMORY DATA
// (No database yet – resets on each deploy)
// ================================
let nextTeacherId = 1;
let nextStudentId = 1;
let nextGoalId = 1;
let nextAssessmentId = 1;
let nextFluencyId = 1;

const teachers = []; // {id, email, password}

const students = [];
const goals = [];
const generalAssessments = [];
const fluencyAssessments = [];

// Logged-in state (simple for now)
let loggedInTeacherId = null;

// ================================
// HELPERS
// ================================
function requireLogin(req, res, next) {
  if (!loggedInTeacherId) return res.redirect("/login");
  next();
}

function getTeacherStudents(teacherId) {
  return students.filter((s) => s.teacherId === teacherId);
}

function getStudentById(id) {
  return students.find((s) => s.id === id);
}

function getGoalById(id) {
  return goals.find((g) => g.id === id);
}

function getLastAssessmentDateForStudent(studentId) {
  const all = [
    ...generalAssessments.filter((a) => a.studentId === studentId),
    ...fluencyAssessments.filter((a) => a.studentId === studentId)
  ];

  if (all.length === 0) return null;

  const latest = all.reduce((acc, a) =>
    new Date(a.date) > new Date(acc.date) ? a : acc
  );
  return latest.date;
}

// ================================
// ROOT REDIRECT
// ================================
app.get("/", (req, res) => {
  if (!loggedInTeacherId) return res.redirect("/login");
  res.redirect("/students");
});

// ================================
// REGISTRATION
// ================================
app.get("/register", (req, res) => {
  res.render("register", {
    error: null,
    hideHeader: true,
    active: null
  });
});

app.post("/register", (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.render("register", {
      error: "Please fill in all fields.",
      hideHeader: true,
      active: null
    });
  }

  if (password !== confirmPassword) {
    return res.render("register", {
      error: "Passwords do not match.",
      hideHeader: true,
      active: null
    });
  }

  const exists = teachers.find(
    (t) => t.email.toLowerCase() === email.toLowerCase()
  );
  if (exists) {
    return res.render("register", {
      error: "An account with this email already exists.",
      hideHeader: true,
      active: null
    });
  }

  const teacher = {
    id: nextTeacherId++,
    email,
    password
  };
  teachers.push(teacher);

  loggedInTeacherId = teacher.id;
  res.redirect("/students");
});

// ================================
// LOGIN / LOGOUT
// ================================
app.get("/login", (req, res) => {
  res.render("login",
