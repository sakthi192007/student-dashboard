package com.example.demo;

import java.util.List;
import java.util.Map;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentRepository repository;

    public StudentController(StudentRepository repository) {
        this.repository = repository;
    }

    private static boolean validMarks(Map<String, Integer> subjects) {
        if (subjects == null || subjects.isEmpty()) {
            return false;
        }
        for (Map.Entry<String, Integer> e : subjects.entrySet()) {
            if (e.getKey() == null || e.getKey().isBlank()
                    || e.getValue() == null || e.getValue() < 0 || e.getValue() > 100) {
                return false;
            }
        }
        return true;
    }

    // GET /api/students  -> every student with subject marks and average
    @GetMapping
    public List<StudentView> getAll() {
        return repository.findAll();
    }

    // Stored procedures: GET /api/students/101
    @GetMapping("/{id}")
    public ResponseEntity<StudentView> getOne(@PathVariable int id) {
        return repository.findByIdUsingProcedure(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Function: GET /api/students/101/grade
    @GetMapping("/{id}/grade")
    public ResponseEntity<Map<String, Object>> getGrade(@PathVariable int id) {
        return repository.findGrade(id)
                .map(g -> ResponseEntity.ok(Map.<String, Object>of("studentId", id, "grade", g)))
                .orElse(ResponseEntity.notFound().build());
    }

    // Insert triggers: POST /api/students
    // {"studentId":104,"studentName":"Arun","department":"IT",
    //  "subjects":{"Tamil":70,"English":80,"Maths":90,"Science":75,"Social":85}}
    @PostMapping
    public ResponseEntity<?> create(@RequestBody NewStudent student) {
        if (!validMarks(student.subjects())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Marks must be between 0 and 100"));
        }
        try {
            repository.save(student);
            return ResponseEntity.status(HttpStatus.CREATED).body(student);
        } catch (DuplicateKeyException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Student ID already exists"));
        }
    }

    // Update triggers: PUT /api/students/101/subjects   {"English": 90, "Maths": 95}
    @PutMapping("/{id}/subjects")
    public ResponseEntity<Void> updateSubjects(@PathVariable int id,
                                               @RequestBody Map<String, Integer> subjects) {
        if (!validMarks(subjects)) {
            return ResponseEntity.badRequest().build();
        }
        return repository.updateSubjects(id, subjects)
                ? ResponseEntity.ok().build()
                : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable int id) {
        return repository.deleteById(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    // Audit rows written by the triggers
    @GetMapping("/audit/inserts")
    public List<Map<String, Object>> insertAudit() {
        return repository.studentAudit();
    }

    @GetMapping("/audit/marks")
    public List<Map<String, Object>> marksAudit() {
        return repository.marksAudit();
    }
}