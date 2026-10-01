package com.example.demo;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class StudentRepository {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<Student> mapper = (rs, rowNum) -> new Student(
            rs.getInt("student_id"),
            rs.getString("student_name"),
            rs.getString("department"),
            rs.getInt("marks"));

    public StudentRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static StudentView toView(Student s, Map<String, Integer> subjects) {
        return new StudentView(s.studentId(), s.studentName(), s.department(), s.marks(), subjects);
    }

    private static int average(Map<String, Integer> subjects) {
        if (subjects == null || subjects.isEmpty()) {
            return 0;
        }
        double sum = 0;
        for (int m : subjects.values()) {
            sum += m;
        }
        return (int) Math.round(sum / subjects.size());
    }

    // ---- all students with their subject marks ----
    public List<StudentView> findAll() {
        List<Student> students =
                jdbcTemplate.query("SELECT * FROM student ORDER BY student_id", mapper);

        Map<Integer, Map<String, Integer>> all = new HashMap<>();
        RowCallbackHandler handler = rs -> all
                .computeIfAbsent(rs.getInt("student_id"), k -> new LinkedHashMap<>())
                .put(rs.getString("subject"), rs.getInt("marks"));
        jdbcTemplate.query("SELECT student_id, subject, marks FROM subject_marks", handler);

        return students.stream()
                .map(s -> toView(s, all.getOrDefault(s.studentId(), new LinkedHashMap<>())))
                .toList();
    }

    // ---- STORED PROCEDURES: get_student + get_subject_marks ----
    public Optional<StudentView> findByIdUsingProcedure(int id) {
        Optional<Student> student = jdbcTemplate
                .query("CALL get_student(?)", mapper, id)
                .stream()
                .findFirst();
        if (student.isEmpty()) {
            return Optional.empty();
        }

        Map<String, Integer> subjects = new LinkedHashMap<>();
        RowCallbackHandler handler = rs -> subjects.put(rs.getString("subject"), rs.getInt("marks"));
        jdbcTemplate.query("CALL get_subject_marks(?)", handler, id);

        return Optional.of(toView(student.get(), subjects));
    }

    // ---- FUNCTION: get_grade (applied to the average) ----
    public Optional<String> findGrade(int id) {
        return jdbcTemplate
                .queryForList(
                        "SELECT get_grade(marks) FROM student WHERE student_id = ?",
                        String.class, id)
                .stream()
                .findFirst();
    }

    // ---- TRIGGERS: after_student_insert + after_subject_insert fire here ----
    @Transactional
    public void save(NewStudent s) {
        jdbcTemplate.update(
                "INSERT INTO student (student_id, student_name, department, marks) VALUES (?, ?, ?, ?)",
                s.studentId(), s.studentName(), s.department(), average(s.subjects()));

        if (s.subjects() != null) {
            for (Map.Entry<String, Integer> e : s.subjects().entrySet()) {
                jdbcTemplate.update(
                        "INSERT INTO subject_marks (student_id, subject, marks) VALUES (?, ?, ?)",
                        s.studentId(), e.getKey(), e.getValue());
            }
        }
    }

    // ---- TRIGGERS: after_subject_update recalculates the average,
    //                after_student_update logs the change ----
    @Transactional
    public boolean updateSubjects(int id, Map<String, Integer> subjects) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM student WHERE student_id = ?", Integer.class, id);
        if (count == null || count == 0) {
            return false;
        }
        for (Map.Entry<String, Integer> e : subjects.entrySet()) {
            jdbcTemplate.update(
                    "INSERT INTO subject_marks (student_id, subject, marks) VALUES (?, ?, ?) "
                            + "ON DUPLICATE KEY UPDATE marks = VALUES(marks)",
                    id, e.getKey(), e.getValue());
        }
        return true;
    }

    public boolean deleteById(int id) {
        return jdbcTemplate.update("DELETE FROM student WHERE student_id = ?", id) > 0;
    }

    // ---- rows written by the triggers ----
    public List<Map<String, Object>> studentAudit() {
        return jdbcTemplate.queryForList("SELECT * FROM student_audit ORDER BY audit_id");
    }

    public List<Map<String, Object>> marksAudit() {
        return jdbcTemplate.queryForList("SELECT * FROM marks_audit ORDER BY audit_id");
    }
}