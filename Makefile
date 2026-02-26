SHELL := /usr/bin/env bash

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
STACK_DIR := $(ROOT_DIR)/stack
STACK_ENV := $(STACK_DIR)/.env
COMPOSE := docker compose --env-file $(STACK_ENV) -f $(STACK_DIR)/docker-compose.yml

.PHONY: up down logs status backup restore test

up:
	./scripts/bootstrap.sh

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

status:
	./scripts/status.sh

backup:
	./scripts/backup.sh

restore:
	./scripts/restore.sh $(if $(BACKUP),--backup $(BACKUP),)

test:
	cd connector && npm test

