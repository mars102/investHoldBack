# Readme

Установить докер далее последовательно выполнить комманды:
	
 docker-compose build 
	
 docker compose up --build 

Приложение поднимается на localhost:8080/api/docs/ вернет свагер с описанием апи
# .env
Также нужно добавить файл с содержимым .env

APP_PORT=80

APP_INTERNAL_PORT=7000

POSTGRES_PORT=5432


POSTGRES_DB=dbname

POSTGRES_USER=postgres

POSTGRES_PASSWORD=Password2025!!!

NODE_ENV=development

PORT=7000

POSTGRES_HOST=postgres

# pgAdmin для работы с базой
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050

http://localhost:5050/ откроетя pgAdmin