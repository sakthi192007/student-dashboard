# Spring Boot REST + MySQL Procedure / Function / Trigger

Run: `mvn spring-boot:run` (set MySQL password in application.properties first).
Tables come from schema.sql; procedure, function and triggers come from routines.sql (both run on startup).

| Feature   | Endpoint                                   | DB object used          |
|-----------|--------------------------------------------|-------------------------|
| Procedure | GET  /api/students/101                     | get_student             |
| Function  | GET  /api/students/101/grade               | get_grade               |
| Trigger   | POST /api/students  (JSON student)         | after_student_insert    |
| Trigger   | PUT  /api/students/101/marks {"marks":95}  | after_student_update    |
| Audit     | GET  /api/students/audit/inserts           | student_audit           |
| Audit     | GET  /api/students/audit/marks             | marks_audit             |
