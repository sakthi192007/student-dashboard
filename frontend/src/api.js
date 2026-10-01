const BASE = "/api/students";

async function request(path = "", options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(res.status === 404 ? "Not found" : `Request failed (${res.status})`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const getAll = () => request();                              // students + subject marks + average
export const getByProcedure = (id) => request(`/${id}`);            // stored procedures
export const getGrade = (id) => request(`/${id}/grade`);            // function
export const addStudent = (s) =>
  request("", { method: "POST", body: JSON.stringify(s) });         // insert triggers
export const updateSubjects = (id, subjects) =>
  request(`/${id}/subjects`, { method: "PUT", body: JSON.stringify(subjects) }); // update triggers
export const deleteStudent = (id) => request(`/${id}`, { method: "DELETE" });
export const getInsertAudit = () => request("/audit/inserts");
export const getMarksAudit = () => request("/audit/marks");