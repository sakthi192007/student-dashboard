package com.example.demo;

import java.util.Map;

/** What the API returns: student details, average (marks) and the subject marks. */
public record StudentView(int studentId, String studentName, String department,
                          int marks, Map<String, Integer> subjects) {
}