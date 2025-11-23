const express = require("express");
const path = require("path");
const layouts = require("express-ejs-layouts");

const app = express();

// ----- Basic setup -----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layout"); // use views/layout.ejs as the default layout

app.use(layouts);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // if you add CSS later

// ----- In-memory data (no real DB yet) -----
// Teachers can register themselves. Data is lost when the app restarts.
let nextTeacherId = 1;
let nextStudentId = 1;
let nextGoalId = 1;
let nextAssessmentId = 1;
let nextFluencyId = 1;

const teachers = []; // { id, email, password }

const students = [];
const goals = [];
const generalAssessments = [];
const fluencyAssessments = [];

// Simple "logged in" flag (NOT secure, just for demo)
let loggedInTeacherId = null;

// ----- Helper functions -----
function requireLogin(req, res, next) {
  if (!loggedInTeacherId) {
    return res.redirect("/login");
  }
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

// ----- Routes -----

// Redirect root to login or students
app.get("/", (req, res) => {
  if (!loggedInTeacherId) {
    return res.redirect("/login");
  }
  res.redirect("/students");
});

// ----- Registration -----
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

  const existing = teachers.find(
    (t) => t.email.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    return res.render("register", {
      error: "An account with this email already exists.",
      hideHeader: true,
      active: null
    });
  }

  const newTeacher = {
    id: nextTeacherId++,
    email,
    password // NOTE: plain text for now; NOT secure for production
  };
  teachers.push(newTeacher);

  // Auto-log in after registration
  loggedInTeacherId = newTeacher.id;
  res.redirect("/students");
});

// ----- Login -----
app.get("/login", (req, res) => {
  res.render("login", {
    error: null,
    hideHeader: true,
    active: null
  });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const teacher = teachers.find(
    (t) =>
      t.email.toLowerCase() === (email || "").toLowerCase() &&
      t.password === password
  );
  if (!teacher) {
    return res.render("login", {
      error: "Incorrect email or password.",
      hideHeader: true,
      active: null
    });
  }
  loggedInTeacherId = teacher.id;
  res.redirect("/students");
});

app.post("/logout", (req, res) => {
  loggedInTeacherId = null;
  res.redirect("/login");
});

// ----- Students -----
app.get("/students", requireLogin, (req, res) => {
  const teacherStudents = getTeacherStudents(loggedInTeacherId).map((s) => {
    const studentGoals = goals.filter((g) => g.studentId === s.id);
    const lastDate = getLastAssessmentDateForStudent(s.id);
    return {
      ...s,
      goalCount: studentGoals.length,
      lastAssessmentDate: lastDate
    };
  });

  res.render("students", { students: teacherStudents, active: "students" });
});

app.post("/students/add", requireLogin, (req, res) => {
  const { firstName, lastName, gradeLevel } = req.body;
  if (!firstName || !lastName || !gradeLevel) {
    return res.redirect("/students");
  }
  students.push({
    id: nextStudentId++,
    teacherId: loggedInTeacherId,
    firstName,
    lastName,
    gradeLevel
  });
  res.redirect("/students");
});

app.post("/students/:id/delete", requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = students.findIndex(
    (s) => s.id === id && s.teacherId === loggedInTeacherId
  );
  if (index !== -1) {
    const studentId = students[index].id;
    for (let i = goals.length - 1; i >= 0; i--) {
      if (goals[i].studentId === studentId) {
        goals.splice(i, 1);
      }
    }
    for (let i = generalAssessments.length - 1; i >= 0; i--) {
      if (generalAssessments[i].studentId === studentId) {
        generalAssessments.splice(i, 1);
      }
    }
    for (let i = fluencyAssessments.length - 1; i >= 0; i--) {
      if (fluencyAssessments[i].studentId === studentId) {
        fluencyAssessments.splice(i, 1);
      }
    }
    students.splice(index, 1);
  }
  res.redirect("/students");
});

app.get("/students/:id", requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const student = getStudentById(id);
  if (!student || student.teacherId !== loggedInTeacherId) {
    return res.redirect("/students");
  }
  const studentGoals = goals.filter((g) => g.studentId === id);
  res.render("student_detail", {
    student,
    goals: studentGoals,
    active: "students"
  });
});

// ----- Goals -----
app.get("/goals", requireLogin, (req, res) => {
  const { studentId, area } = req.query;
  const teacherStudents = getTeacherStudents(loggedInTeacherId);

  let filteredGoals = goals.filter((g) =>
    teacherStudents.some((s) => s.id === g.studentId)
  );

  if (studentId) {
    const sid = parseInt(studentId, 10);
    filteredGoals = filteredGoals.filter((g) => g.studentId === sid);
  }
  if (area && area !== "all") {
    filteredGoals = filteredGoals.filter((g) => g.area === area);
  }

  const goalsWithStudent = filteredGoals.map((g) => {
    const s = getStudentById(g.studentId);
    return {
      ...g,
      studentName: s ? `${s.firstName} ${s.lastName}` : "Unknown"
    };
  });

  res.render("goals", {
    students: teacherStudents,
    goals: goalsWithStudent,
    selectedStudentId: studentId || "",
    selectedArea: area || "all",
    active: "goals"
  });
});

app.post("/goals/add", requireLogin, (req, res) => {
  const { studentId, area, description, goalGradeLevel, masteryCriteria } =
    req.body;
  const sid = parseInt(studentId, 10);
  if (!sid || !area || !description || !goalGradeLevel || !masteryCriteria) {
    return res.redirect("/goals");
  }
  goals.push({
    id: nextGoalId++,
    studentId: sid,
    area,
    description,
    goalGradeLevel,
    masteryCriteria,
    active: true
  });
  res.redirect("/goals?studentId=" + sid);
});

app.post("/goals/:id/delete", requireLogin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = goals.findIndex((g) => g.id === id);
  if (index !== -1) {
    goals.splice(index, 1);
  }
  res.redirect("/goals");
});

// ----- Assessments -----
app.get("/assessments", requireLogin, (req, res) => {
  const { tab, studentId } = req.query;
  const teacherStudents = getTeacherStudents(loggedInTeacherId);
  const selectedStudentId = studentId ? parseInt(studentId, 10) : null;
  const studentGoals =
    selectedStudentId != null
      ? goals.filter((g) => g.studentId === selectedStudentId && g.active)
      : [];

  res.render("assessments", {
    tab: tab || "general",
    students: teacherStudents,
    selectedStudentId,
    studentGoals,
    generatedItems: [],
    generalSummary: null,
    fluencyData: null,
    message: null,
    active: "assessments"
  });
});

// Generate general assessment items
app.post("/assessments/general/generate", requireLogin, (req, res) => {
  const { studentId, goalIds } = req.body;
  const teacherStudents = getTeacherStudents(loggedInTeacherId);
  const sid = parseInt(studentId, 10);
  const selectedStudentId = sid || null;

  let selectedGoals = [];
  if (Array.isArray(goalIds)) {
    selectedGoals = goalIds.map((id) => getGoalById(parseInt(id, 10))).filter(
      Boolean
    );
  } else if (goalIds) {
    const g = getGoalById(parseInt(goalIds, 10));
    if (g) selectedGoals.push(g);
  }

  const generatedItems = [];
  selectedGoals.forEach((g) => {
    generatedItems.push({
      goalId: g.id,
      goalArea: g.area,
      goalDescription: g.description,
      prompt: `Sample item for goal "${g.description}"`,
      correctAnswer: "Teacher-defined correct answer",
      score: "incorrect"
    });
  });

  const studentGoals =
    selectedStudentId != null
      ? goals.filter((g) => g.studentId === selectedStudentId && g.active)
      : [];

  res.render("assessments", {
    tab: "general",
    students: teacherStudents,
    selectedStudentId,
    studentGoals,
    generatedItems,
    generalSummary: null,
    fluencyData: null,
    message: null,
    active: "assessments"
  });
});

// Save general assessment
app.post("/assessments/general/save", requireLogin, (req, res) => {
  const { studentId, date } = req.body;
  const sid = parseInt(studentId, 10);
  if (!sid) {
    return res.redirect("/assessments?tab=general");
  }

  const items = [];
  const body = req.body;
  const goalIds = Array.isArray(body.goalId) ? body.goalId : [body.goalId];
  const prompts = Array.isArray(body.prompt) ? body.prompt : [body.prompt];
  const correctAnswers = Array.isArray(body.correctAnswer)
    ? body.correctAnswer
    : [body.correctAnswer];
  const scores = Array.isArray(body.score) ? body.score : [body.score];

  for (let i = 0; i < goalIds.length; i++) {
    if (!goalIds[i]) continue;
    items.push({
      goalId: parseInt(goalIds[i], 10),
      prompt: prompts[i],
      correctAnswer: correctAnswers[i],
      score: scores[i] || "incorrect"
    });
  }

  const assessmentDate = date || new Date().toISOString().slice(0, 10);

  generalAssessments.push({
    id: nextAssessmentId++,
    studentId: sid,
    date: assessmentDate,
    items
  });

  res.redirect("/assessments?tab=general&studentId=" + sid);
});

// Generate / Save fluency assessment
app.post("/assessments/fluency/generate", requireLogin, (req, res) => {
  const { studentId, topic } = req.body;
  const teacherStudents = getTeacherStudents(loggedInTeacherId);
  const sid = parseInt(studentId, 10);
  const selectedStudentId = sid || null;

  const studentGoals =
    selectedStudentId != null
      ? goals.filter((g) => g.studentId === selectedStudentId && g.active)
      : [];

  const passageText =
    "This is a sample reading passage generated for fluency practice. " +
    "In a real app, this text would match the student's grade level and chosen topic.";

  const fluencyData = {
    studentId: selectedStudentId,
    topic: topic || "",
    passageText,
    totalWordsAttempted: "",
    errors: "",
    wcpm: "",
    accuracyPercent: ""
  };

  res.render("assessments", {
    tab: "fluency",
    students: teacherStudents,
    selectedStudentId,
    studentGoals,
    generatedItems: [],
    generalSummary: null,
    fluencyData,
    message: null,
    active: "assessments"
  });
});

app.post("/assessments/fluency/save", requireLogin, (req, res) => {
  const { studentId, date, totalWordsAttempted, errors } = req.body;
  const sid = parseInt(studentId, 10);
  if (!sid) {
    return res.redirect("/assessments?tab=fluency");
  }

  const attempted = parseInt(totalWordsAttempted, 10) || 0;
  const err = parseInt(errors, 10) || 0;
  if (attempted <= 0 || err < 0 || err > attempted) {
    return res.redirect("/assessments?tab=fluency&studentId=" + sid);
  }

  const correct = attempted - err;
  const wcpm = correct;
  const accuracyPercent = (correct / attempted) * 100;

  const assessmentDate = date || new Date().toISOString().slice(0, 10);

  fluencyAssessments.push({
    id: nextFluencyId++,
    studentId: sid,
    date: assessmentDate,
    totalWordsAttempted: attempted,
    errors: err,
    wcpm,
    accuracyPercent
  });

  res.redirect("/assessments?tab=fluency&studentId=" + sid);
});

// ----- Reports -----
app.get("/reports", requireLogin, (req, res) => {
  const { tab } = req.query;
  if (tab === "class") {
    return res.redirect("/reports/class");
  }
  res.redirect("/reports/student");
});

app.get("/reports/student", requireLogin, (req, res) => {
  const { studentId } = req.query;
  const teacherStudents = getTeacherStudents(loggedInTeacherId);

  let selectedStudent = null;
  let goalsSummary = [];
  let fluencySummary = [];

  if (studentId) {
    const sid = parseInt(studentId, 10);
    selectedStudent = getStudentById(sid);
    if (selectedStudent && selectedStudent.teacherId === loggedInTeacherId) {
      const studentGoals = goals.filter((g) => g.studentId === sid);
      goalsSummary = studentGoals.map((g) => {
        const gAssessments = generalAssessments
          .filter((a) => a.studentId === sid)
          .flatMap((a) =>
            a.items.filter((it) => it.goalId === g.id).map((it) => ({ a, it }))
          );

        let latestPercent = null;
        if (gAssessments.length > 0) {
          const byDate = {};
          gAssessments.forEach(({ a, it }) => {
            if (!byDate[a.date]) byDate[a.date] = [];
            byDate[a.date].push(it);
          });
          const latestDate = Object.keys(byDate).sort().slice(-1)[0];
          const items = byDate[latestDate];
          const total = items.length;
          const correct = items.filter((it) => it.score === "correct").length;
          latestPercent = total ? (correct / total) * 100 : null;
        }

        return {
          goalId: g.id,
          description: g.description,
          area: g.area,
          latestPercentCorrect: latestPercent,
          trend: latestPercent === null ? "No Data" : "Flat",
          status:
            latestPercent === null
              ? "No Recent Data"
              : latestPercent >= 80
              ? "On Track"
              : "Needs Support"
        };
      });

      fluencySummary = fluencyAssessments
        .filter((f) => f.studentId === sid)
        .map((f) => ({
          date: f.date,
          wcpm: f.wcpm,
          accuracyPercent: f.accuracyPercent,
          trend: "Flat"
        }));
    }
  }

  res.render("reports_student", {
    students: teacherStudents,
    selectedStudent,
    goalsSummary,
    fluencySummary,
    active: "reports"
  });
});

app.get("/reports/class", requireLogin, (req, res) => {
  const { area, grade } = req.query;
  const teacherStudents = getTeacherStudents(loggedInTeacherId);

  let rows = [];

  teacherStudents.forEach((s) => {
    const studentGoals = goals.filter((g) => g.studentId === s.id);
    studentGoals.forEach((g) => {
      const gAssessments = generalAssessments
        .filter((a) => a.studentId === s.id)
        .flatMap((a) =>
          a.items.filter((it) => it.goalId === g.id).map((it) => ({ a, it }))
        );
      let latestPercent = null;
      if (gAssessments.length > 0) {
        const byDate = {};
        gAssessments.forEach(({ a, it }) => {
          if (!byDate[a.date]) byDate[a.date] = [];
          byDate[a.date].push(it);
        });
        const latestDate = Object.keys(byDate).sort().slice(-1)[0];
        const items = byDate[latestDate];
        const total = items.length;
        const correct = items.filter((it) => it.score === "correct").length;
        latestPercent = total ? (correct / total) * 100 : null;
      }

      const studentFluencies = fluencyAssessments.filter(
        (f) => f.studentId === s.id
      );
      const latestFluency =
        studentFluencies.length > 0
          ? studentFluencies.reduce((acc, f) =>
              new Date(f.date) > new Date(acc.date) ? f : acc
            )
          : null;

      rows.push({
        studentId: s.id,
        studentName: `${s.firstName} ${s.lastName}`,
        goalArea: g.area,
        shortGoalDescription:
          g.description.length > 60
            ? g.description.slice(0, 57) + "..."
            : g.description,
        latestPercentCorrect: latestPercent,
        latestFluencyWcpm: latestFluency ? latestFluency.wcpm : null,
        status:
          latestPercent === null
            ? "No Recent Data"
            : latestPercent >= 80
            ? "On Track"
            : "Needs Support",
        gradeLevel: s.gradeLevel
      });
    });
  });

  if (area && area !== "all") {
    rows = rows.filter((r) => r.goalArea === area);
  }
  if (grade && grade !== "all") {
    rows = rows.filter((r) => r.gradeLevel === grade);
  }

  const grades = [
    ...new Set(teacherStudents.map((s) => s.gradeLevel).filter(Boolean))
  ];

  res.render("reports_class", {
    rows,
    selectedArea: area || "all",
    selectedGrade: grade || "all",
    grades,
    active: "reports"
  });
});

// ----- Start server -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Progress-Monitoring app listening on port ${PORT}`);
});
