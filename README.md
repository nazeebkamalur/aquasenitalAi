## AquaSentinel AI demo

### Start the presentation

Open two PowerShell terminals from the project root.

Terminal 1, start the API:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8001
```

Terminal 2, serve the frontend:

```powershell
.\.venv\Scripts\python.exe -m http.server 5500 --directory frontend
```

Open <http://127.0.0.1:5500/templates/login.html>.

The API health check is available at <http://127.0.0.1:8001/api/health>.

### Demo accounts

| Role          | Email                   | Password    |
| ------------- | ----------------------- | ----------- |
| User          | `user@aquasentinel.ai`  | `User@123`  |
| Government    | `gov@aquasentinel.ai`   | `Gov@123`   |
| Administrator | `admin@aquasentinel.ai` | `Admin@123` |

The backend creates the SQLite database automatically. To recreate the demo accounts, run:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe create_users.py
```
