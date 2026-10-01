# Student Manager: React + Spring Boot + MySQL (Docker)

## Run everything with Docker
    docker compose up --build

- Frontend (React): http://localhost:3000
- Backend  (REST) : http://localhost:8080/api/students
- MySQL creds     : root / rootpass (database `college`)

Stop: `docker compose down`   (add `-v` to also delete the database data)

## Run without Docker (development)
1. Start MySQL and the backend from `backend/` (set your password in application.properties):
       mvn spring-boot:run
2. Start the frontend from `frontend/`:
       npm install
       npm run dev
   Open http://localhost:5173
   If your backend uses another port (e.g. 8082):
       VITE_API_TARGET=http://localhost:8082 npm run dev
   (Windows PowerShell: `$env:VITE_API_TARGET="http://localhost:8082"; npm run dev`)

## Structure
    backend/            Spring Boot API (+ Dockerfile)
    frontend/           React (Vite) app (+ Dockerfile, nginx.conf)
    docker-compose.yml  db + backend + frontend
