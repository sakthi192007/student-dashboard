package com.example.demo;

import java.util.Map;

/** Body of POST /api/students : the student plus marks for each subject. */
public record NewStudent(int studentId, String studentName, String department,
                         Map<String, Integer> subjects) {
}