import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api.js";

const POLL_MS = 3000; // how often the dashboard refreshes by itself
const SUBJECTS = ["Tamil", "English", "Maths", "Science", "Social"];
const GRADE_ORDER = ["A+", "A", "B", "C", "D", "F"];
const emptySubjects = () => Object.fromEntries(SUBJECTS.map((s) => [s, ""]));
const emptyForm = () => ({ studentId: "", studentName: "", department: "", subjects: emptySubjects() });

const gradeClass = (g) => "grade g-" + String(g).replace("+", "plus");

// average of the filled-in values
function averageOf(values) {
  const nums = values.filter((v) => v !== "" && v !== null && v !== undefined).map(Number);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function App() {
  const [students, setStudents] = useState([]);
  const [grades, setGrades] = useState({});
  const [activity, setActivity] = useState([]);
  const [freshKeys, setFreshKeys] = useState(new Set());
  const [flash, setFlash] = useState({});
  const [live, setLive] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editSubjects, setEditSubjects] = useState(emptySubjects());
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const busy = useRef(false);
  const prevSig = useRef(null); // Map(id -> signature) from the previous refresh
  const seenKeys = useRef(null); // activity keys already seen
  const gradeCache = useRef({}); // id -> { marks, grade }

  // ---------- fetch everything from the server ----------
  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const [list, inserts, marksLog] = await Promise.all([
        api.getAll(),
        api.getInsertAudit(),
        api.getMarksAudit(),
      ]);

      // grade comes from the database function; only ask again when the average changes
      const cache = gradeCache.current;
      await Promise.all(
        list.map(async (s) => {
          const c = cache[s.studentId];
          if (!c || c.marks !== s.marks) {
            try {
              const r = await api.getGrade(s.studentId);
              cache[s.studentId] = { marks: s.marks, grade: r.grade };
            } catch {
              cache[s.studentId] = { marks: s.marks, grade: "-" };
            }
          }
        })
      );
      const gradeMap = {};
      list.forEach((s) => (gradeMap[s.studentId] = cache[s.studentId]?.grade ?? "-"));

      // highlight rows that are new or changed since the last refresh
      const sigOf = (s) => s.marks + "|" + JSON.stringify(s.subjects);
      const prev = prevSig.current;
      if (prev) {
        const f = {};
        list.forEach((s) => {
          if (!prev.has(s.studentId)) f[s.studentId] = "new";
          else if (prev.get(s.studentId) !== sigOf(s)) f[s.studentId] = "changed";
        });
        if (Object.keys(f).length) {
          setFlash(f);
          setTimeout(() => setFlash({}), 3500);
        }
      }
      prevSig.current = new Map(list.map((s) => [s.studentId, sigOf(s)]));

      // activity feed (written by the database triggers)
      const names = {};
      inserts.forEach((a) => (names[a.student_id] = a.student_name));
      list.forEach((s) => (names[s.studentId] = s.studentName));
      const feed = [
        ...inserts.map((a) => ({
          key: "i" + a.audit_id,
          time: new Date(a.action_time),
          text: `${a.student_name} was added`,
        })),
        ...marksLog
          .filter((a) => a.old_marks !== a.new_marks)
          .map((a) => ({
            key: "m" + a.audit_id,
            time: new Date(a.changed_at),
            text: `${names[a.student_id] || "Student " + a.student_id}'s average changed from ${a.old_marks} to ${a.new_marks}`,
          })),
      ].sort((x, y) => y.time - x.time);

      const seen = seenKeys.current;
      if (seen) {
        const fresh = new Set(feed.filter((a) => !seen.has(a.key)).map((a) => a.key));
        if (fresh.size) {
          setFreshKeys(fresh);
          setTimeout(() => setFreshKeys(new Set()), 4000);
        }
      }
      seenKeys.current = new Set(feed.map((a) => a.key));

      setStudents(list);
      setGrades(gradeMap);
      setActivity(feed.slice(0, 10));
      setOnline(true);
      setLastUpdated(new Date());
    } catch {
      setOnline(false);
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [live, load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- actions ----------
  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.addStudent({
        studentId: Number(form.studentId),
        studentName: form.studentName.trim(),
        department: form.department.trim(),
        subjects: Object.fromEntries(SUBJECTS.map((s) => [s, Number(form.subjects[s])])),
      });
      setForm(emptyForm());
      setToast("Student added successfully");
      load();
    } catch {
      setError("Could not add student. The ID may already exist.");
    }
  }

  function startEdit(s) {
    setEditingId(s.studentId);
    setEditSubjects(Object.fromEntries(SUBJECTS.map((sub) => [sub, s.subjects?.[sub] ?? ""])));
  }

  async function handleSaveMarks(id) {
    const body = {};
    SUBJECTS.forEach((sub) => {
      if (editSubjects[sub] !== "") body[sub] = Number(editSubjects[sub]);
    });
    if (Object.keys(body).length === 0) return;
    try {
      await api.updateSubjects(id, body);
      setEditingId(null);
      setToast("Marks updated");
      load();
    } catch {
      setError("Could not update marks.");
    }
  }

  async function handleDelete(s) {
    if (!window.confirm(`Delete ${s.studentName}?`)) return;
    try {
      await api.deleteStudent(s.studentId);
      setToast("Student deleted");
      load();
    } catch {
      setError("Could not delete student.");
    }
  }

  async function handleView(id) {
    try {
      const [s, g] = await Promise.all([api.getByProcedure(id), api.getGrade(id)]);
      setDetail({ ...s, grade: g.grade });
    } catch {
      setError("Could not load student details.");
    }
  }

  // ---------- derived data ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        String(s.studentId).includes(q)
    );
  }, [students, search]);

  const total = students.length;
  const classAverage = total ? Math.round(students.reduce((sum, s) => sum + s.marks, 0) / total) : 0;
  const topper = students.reduce((best, s) => (!best || s.marks > best.marks ? s : best), null);
  const passed = students.filter((s) => grades[s.studentId] && grades[s.studentId] !== "F").length;
  const passRate = total ? Math.round((passed / total) * 100) : 0;

  const distribution = GRADE_ORDER.map((g) => ({
    grade: g,
    count: students.filter((s) => grades[s.studentId] === g).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  const subjectAverages = SUBJECTS.map((sub) => ({
    subject: sub,
    value: averageOf(students.map((s) => s.subjects?.[sub])),
  }));

  const formAverage = averageOf(SUBJECTS.map((s) => form.subjects[s]));
  const editAverage = averageOf(SUBJECTS.map((s) => editSubjects[s]));

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setFormSubject = (sub) => (e) =>
    setForm({ ...form, subjects: { ...form.subjects, [sub]: e.target.value } });

  // ---------- UI ----------
  return (
    <div className="container">
      <header className="header">
        <div>
          <h1>Student Dashboard</h1>
          <p>
            {online
              ? lastUpdated
                ? `Last updated ${lastUpdated.toLocaleTimeString()}`
                : "Loading..."
              : "Connection lost. Retrying..."}
          </p>
        </div>
        <div className="live-box">
          <span className={"badge " + (!online ? "offline" : live ? "live" : "paused")}>
            <i className="dot" />
            {!online ? "Offline" : live ? "Live" : "Paused"}
          </span>
          <button onClick={() => setLive(!live)}>{live ? "Pause" : "Resume"}</button>
        </div>
      </header>

      {error && (
        <div className="error">
          {error}
          <button className="link" onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}

      <div className="stats">
        <div className="stat"><span>Total students</span><strong>{total}</strong></div>
        <div className="stat"><span>Class average</span><strong>{classAverage}</strong></div>
        <div className="stat"><span>Pass rate</span><strong>{passRate}%</strong></div>
        <div className="stat"><span>Top scorer</span><strong>{topper ? topper.studentName : "-"}</strong></div>
      </div>

      <div className="three-col">
        <section className="card">
          <h2>Subject averages</h2>
          <div className="bars">
            {subjectAverages.map((d) => (
              <div className="bar-row wide" key={d.subject}>
                <span className="bar-label">{d.subject}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: (d.value ?? 0) + "%" }} />
                </div>
                <b>{d.value ?? "-"}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Grade distribution</h2>
          <div className="bars">
            {distribution.map((d) => (
              <div className="bar-row" key={d.grade}>
                <span className={gradeClass(d.grade)}>{d.grade}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: (d.count / maxCount) * 100 + "%" }} />
                </div>
                <b>{d.count}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Live activity</h2>
          {activity.length === 0 ? (
            <p className="empty">No activity yet</p>
          ) : (
            <ul className="activity">
              {activity.map((a) => (
                <li key={a.key} className={freshKeys.has(a.key) ? "fresh" : ""}>
                  <span>{a.text}</span>
                  <time>{a.time.toLocaleTimeString()}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Add student</h2>
        <form onSubmit={handleAdd} className="form">
          <label>ID<input required type="number" value={form.studentId} onChange={setField("studentId")} /></label>
          <label>Name<input required value={form.studentName} onChange={setField("studentName")} /></label>
          <label>Department<input required value={form.department} onChange={setField("department")} /></label>
          {SUBJECTS.map((sub) => (
            <label key={sub}>
              {sub}
              <input
                className="mini"
                required
                type="number"
                min="0"
                max="100"
                value={form.subjects[sub]}
                onChange={setFormSubject(sub)}
              />
            </label>
          ))}
          <div className="avg-preview">
            Average
            <strong>{formAverage ?? "-"}</strong>
          </div>
          <button type="submit" className="primary">Add student</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Students</h2>
          <input
            className="search"
            placeholder="Search by name, department or ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <table className="students-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Department</th>
              {SUBJECTS.map((sub) => (
                <th key={sub} className="num">{sub}</th>
              ))}
              <th className="num">Average</th>
              <th>Grade</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const editing = editingId === s.studentId;
              return (
                <tr key={s.studentId} className={flash[s.studentId] ? "row-" + flash[s.studentId] : ""}>
                  <td>{s.studentId}</td>
                  <td>{s.studentName}</td>
                  <td>{s.department}</td>
                  {SUBJECTS.map((sub) => (
                    <td key={sub} className="num">
                      {editing ? (
                        <input
                          className="mini"
                          type="number"
                          min="0"
                          max="100"
                          value={editSubjects[sub]}
                          onChange={(e) => setEditSubjects({ ...editSubjects, [sub]: e.target.value })}
                        />
                      ) : (
                        s.subjects?.[sub] ?? "-"
                      )}
                    </td>
                  ))}
                  <td className="num avg">{editing ? editAverage ?? "-" : s.marks}</td>
                  <td>
                    <span className={gradeClass(grades[s.studentId] ?? "-")}>
                      {grades[s.studentId] ?? "-"}
                    </span>
                  </td>
                  <td className="actions">
                    {editing ? (
                      <>
                        <button className="primary" onClick={() => handleSaveMarks(s.studentId)}>Save</button>
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleView(s.studentId)}>View</button>
                        <button onClick={() => startEdit(s)}>Edit marks</button>
                        <button className="danger" onClick={() => handleDelete(s)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={SUBJECTS.length + 6} className="empty">No students found</td></tr>
            )}
          </tbody>
        </table>
      </section>

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{detail.studentName}</h2>
            <dl>
              <dt>Student ID</dt><dd>{detail.studentId}</dd>
              <dt>Department</dt><dd>{detail.department}</dd>
            </dl>

            <div className="bars subject-list">
              {SUBJECTS.map((sub) => {
                const v = detail.subjects?.[sub];
                return (
                  <div className="bar-row wide" key={sub}>
                    <span className="bar-label">{sub}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: (v ?? 0) + "%" }} />
                    </div>
                    <b>{v ?? "-"}</b>
                  </div>
                );
              })}
            </div>

            <div className="summary-row">
              <span>Average <strong>{detail.marks}</strong></span>
              <span>Grade <span className={gradeClass(detail.grade)}>{detail.grade}</span></span>
            </div>
            <button className="primary" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}