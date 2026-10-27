.DEFAULT_GOAL := run

# Executables
PNPM ?= $(shell which pnpm 2>/dev/null || echo npm)
PYTHON ?= python3

# Colors for terminal output
CYAN  := \033[36m
GREEN := \033[32m
YELLOW:= \033[33m
RED   := \033[31m
RESET := \033[0m
BOLD  := \033[1m

.PHONY: all run dev start build install test benchmark clean help status

## 🚀 One-command local runner
run: setup dist/server.js
	@echo "\n$(GREEN)$(BOLD)✓ Starting Dossier on http://localhost:3000$(RESET)\n"
	@$(PNPM) start

## 💻 Live development mode (auto-reload with tsx)
dev: setup
	@echo "\n$(CYAN)$(BOLD)⚡ Starting Dossier in Dev Mode (tsx)...$(RESET)\n"
	@$(PNPM) run dev

## 📦 Install dependencies & prepare environment
setup: .env node_modules .python_deps
	@mkdir -p data data/reports dist

.env:
	@if [ ! -f .env ]; then \
		echo "$(YELLOW)Notice: .env not found. Creating from .env.example...$(RESET)"; \
		cp .env.example .env; \
	fi

node_modules: package.json
	@echo "$(CYAN)Installing Node dependencies via $(PNPM)...$(RESET)"
	@$(PNPM) install
	@touch node_modules

.python_deps: requirements.txt
	@echo "$(CYAN)Checking Python dependencies...$(RESET)"
	@$(PYTHON) -m pip install -q -r requirements.txt 2>/dev/null || true
	@touch .python_deps

dist/server.js: package.json tsconfig.json
	@echo "$(CYAN)Building application...$(RESET)"
	@$(PNPM) run build

## 🔨 Force build TypeScript & asset pipelines
build: setup
	@echo "$(CYAN)Rebuilding application...$(RESET)"
	@$(PNPM) run build

## 🧪 Run full test suite
test: setup
	@echo "$(CYAN)Running unit & decision model tests...$(RESET)"
	@$(PNPM) test

## ⚡ Run benchmarks
benchmark: setup
	@echo "$(CYAN)Running adversarial benchmark suite...$(RESET)"
	@$(PNPM) run benchmark

## 🧹 Clean build artifacts & temp files
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(RESET)"
	@rm -rf dist .python_deps
	@echo "$(GREEN)Clean complete.$(RESET)"

## ℹ️ Show current service health
status:
	@curl -s http://localhost:3000/health | jq . 2>/dev/null || curl -s http://localhost:3000/health || echo "$(RED)Server not running on :3000$(RESET)"

## 📖 Help menu
help:
	@echo ""
	@echo "$(BOLD)$(CYAN)Dossier — Adversarial Multi-Agent Platform$(RESET)"
	@echo "Usage: make $(GREEN)<target>$(RESET)"
	@echo ""
	@echo "Targets:"
	@echo "  $(GREEN)make$(RESET) or $(GREEN)make run$(RESET)     Set up and run the production server on http://localhost:3000"
	@echo "  $(GREEN)make dev$(RESET)             Run in live development mode (tsx hot reloading)"
	@echo "  $(GREEN)make build$(RESET)           Compile TypeScript & copy Python simulation models to dist/"
	@echo "  $(GREEN)make setup$(RESET)           Install Node & Python dependencies, ensure .env exists"
	@echo "  $(GREEN)make test$(RESET)            Run test suite (stress tests, decision model tests)"
	@echo "  $(GREEN)make benchmark$(RESET)       Run the 10-concept adversarial benchmark suite"
	@echo "  $(GREEN)make status$(RESET)          Query live health endpoint on localhost:3000"
	@echo "  $(GREEN)make clean$(RESET)           Remove dist/ and temporary build files"
	@echo ""
