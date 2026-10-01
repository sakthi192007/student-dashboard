-- =====================================================
--  Run this whole file in MySQL Workbench (lightning icon)
--  Safe to run again: it will not delete your students.
-- =====================================================

CREATE DATABASE IF NOT EXISTS college;
USE college;

-- ---------- TABLES ----------
CREATE TABLE IF NOT EXISTS student (
    student_id   INT PRIMARY KEY,
    student_name VARCHAR(50),
    department   VARCHAR(30),
    marks        INT          -- average of all subjects (kept up to date by a trigger)
);

CREATE TABLE IF NOT EXISTS subject_marks (
    student_id INT,
    subject    VARCHAR(30),
    marks      INT,
    PRIMARY KEY (student_id, subject),
    FOREIGN KEY (student_id) REFERENCES student(student_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_audit (
    audit_id     INT AUTO_INCREMENT PRIMARY KEY,
    student_id   INT,
    student_name VARCHAR(50),
    action       VARCHAR(20),
    action_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marks_audit (
    audit_id   INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    old_marks  INT,
    new_marks  INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- SAMPLE DATA ----------
INSERT IGNORE INTO student VALUES
(101, 'Ravi',  'IT',  85),
(102, 'Priya', 'CSE', 72),
(103, 'Kumar', 'ECE', 91);

INSERT IGNORE INTO subject_marks VALUES
(101, 'Tamil', 80), (101, 'English', 85), (101, 'Maths', 90), (101, 'Science', 85), (101, 'Social', 85),
(102, 'Tamil', 70), (102, 'English', 75), (102, 'Maths', 72), (102, 'Science', 68), (102, 'Social', 75),
(103, 'Tamil', 90), (103, 'English', 92), (103, 'Maths', 95), (103, 'Science', 88), (103, 'Social', 90);

-- ---------- PROCEDURES, FUNCTION, TRIGGERS ----------
DELIMITER //

DROP PROCEDURE IF EXISTS get_student//

CREATE PROCEDURE get_student(IN p_id INT)
BEGIN
    SELECT student_id, student_name, department, marks
    FROM student
    WHERE student_id = p_id;
END//

DROP PROCEDURE IF EXISTS get_subject_marks//

CREATE PROCEDURE get_subject_marks(IN p_id INT)
BEGIN
    SELECT subject, marks
    FROM subject_marks
    WHERE student_id = p_id
    ORDER BY subject;
END//

DROP FUNCTION IF EXISTS get_grade//

CREATE FUNCTION get_grade(p_marks INT)
RETURNS VARCHAR(2)
DETERMINISTIC
BEGIN
    DECLARE v_grade VARCHAR(2);

    IF p_marks >= 90 THEN SET v_grade = 'A+';
    ELSEIF p_marks >= 80 THEN SET v_grade = 'A';
    ELSEIF p_marks >= 70 THEN SET v_grade = 'B';
    ELSEIF p_marks >= 60 THEN SET v_grade = 'C';
    ELSEIF p_marks >= 50 THEN SET v_grade = 'D';
    ELSE SET v_grade = 'F';
    END IF;

    RETURN v_grade;
END//

DROP TRIGGER IF EXISTS after_student_insert//

CREATE TRIGGER after_student_insert
AFTER INSERT ON student
FOR EACH ROW
BEGIN
    INSERT INTO student_audit (student_id, student_name, action)
    VALUES (NEW.student_id, NEW.student_name, 'INSERT');
END//

-- logs the average only when it really changes
DROP TRIGGER IF EXISTS after_student_update//

CREATE TRIGGER after_student_update
AFTER UPDATE ON student
FOR EACH ROW
BEGIN
    IF NOT (OLD.marks <=> NEW.marks) THEN
        INSERT INTO marks_audit (student_id, old_marks, new_marks)
        VALUES (OLD.student_id, OLD.marks, NEW.marks);
    END IF;
END//

-- keeps student.marks = average of the subject marks
DROP TRIGGER IF EXISTS after_subject_insert//

CREATE TRIGGER after_subject_insert
AFTER INSERT ON subject_marks
FOR EACH ROW
BEGIN
    UPDATE student
    SET marks = (SELECT COALESCE(ROUND(AVG(sm.marks)), 0)
                 FROM subject_marks sm
                 WHERE sm.student_id = NEW.student_id)
    WHERE student_id = NEW.student_id;
END//

DROP TRIGGER IF EXISTS after_subject_update//

CREATE TRIGGER after_subject_update
AFTER UPDATE ON subject_marks
FOR EACH ROW
BEGIN
    UPDATE student
    SET marks = (SELECT COALESCE(ROUND(AVG(sm.marks)), 0)
                 FROM subject_marks sm
                 WHERE sm.student_id = NEW.student_id)
    WHERE student_id = NEW.student_id;
END//

DELIMITER ;

-- ---------- CHECK (optional) ----------
SELECT * FROM student;
SELECT * FROM subject_marks;
SHOW TRIGGERS;