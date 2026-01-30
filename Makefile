.PHONY: up down logs build clean

up:
	docker-compose -f infra/docker-compose.yml up --build -d

up-logs:
	docker-compose -f infra/docker-compose.yml up --build

down:
	docker-compose -f infra/docker-compose.yml down

logs:
	docker-compose -f infra/docker-compose.yml logs -f

clean:
	docker-compose -f infra/docker-compose.yml down -v

ollama-pull:
	docker exec $$(docker ps -qf "name=ollama") ollama pull llama2
