#!/bin/bash

# AI Browser Launcher Script
# Автоматический запуск системы с проверками зависимостей

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 AI Browser Launcher${NC}\n"

# Функция для проверки команды
check_command() {
  if command -v "$1" &> /dev/null; then
    echo -e "${GREEN}✅${NC} $1 установлен"
    return 0
  else
    echo -e "${RED}❌${NC} $1 не найден"
    return 1
  fi
}

# Функция для проверки Node.js модуля
check_module() {
  local module_path="$1"
  if [ -d "$module_path/node_modules" ]; then
    echo -e "${GREEN}✅${NC} Зависимости установлены: $(basename "$module_path")"
    return 0
  else
    echo -e "${YELLOW}⚠️${NC}  Зависимости не установлены: $(basename "$module_path")"
    return 1
  fi
}

# === 1. Проверка системных требований ===
echo -e "${BLUE}=== Проверка системных требований ===${NC}\n"

missing_deps=0

if ! check_command "node"; then
  echo -e "${RED}   Установите Node.js >= 18: https://nodejs.org/${NC}"
  missing_deps=1
fi

if ! check_command "npm"; then
  echo -e "${RED}   npm должен быть установлен вместе с Node.js${NC}"
  missing_deps=1
fi

if check_command "node"; then
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$node_version" -lt 18 ]; then
    echo -e "${YELLOW}   Версия Node.js < 18, рекомендуется обновление${NC}"
  fi
fi

# Проверка Redis (опционально)
if check_command "redis-cli"; then
  if redis-cli ping &> /dev/null; then
    echo -e "${GREEN}✅${NC} Redis запущен и доступен"
  else
    echo -e "${YELLOW}⚠️${NC}  Redis установлен, но не запущен"
    echo -e "${YELLOW}   Запустите: redis-server${NC}"
    echo -e "${YELLOW}   Или Docker: docker run -d -p 6379:6379 redis:7-alpine${NC}"
  fi
else
  echo -e "${YELLOW}⚠️${NC}  Redis не установлен (опционально)"
  echo -e "${YELLOW}   Для полной функциональности: docker run -d -p 6379:6379 redis:7-alpine${NC}"
fi

echo ""

if [ $missing_deps -eq 1 ]; then
  echo -e "${RED}❌ Не все зависимости установлены. Смотрите SETUP.md${NC}\n"
  exit 1
fi

# === 2. Проверка установки зависимостей модулей ===
echo -e "${BLUE}=== Проверка зависимостей модулей ===${NC}\n"

modules=("electron-app" "coordination" "task-queue" "browser-control" "tools" "redis-integration")
needs_install=0

for module in "${modules[@]}"; do
  if ! check_module "$module"; then
    needs_install=1
  fi
done

echo ""

if [ $needs_install -eq 1 ]; then
  echo -e "${YELLOW}Некоторые модули требуют установки зависимостей${NC}"
  read -p "Установить сейчас? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${BLUE}Установка зависимостей...${NC}\n"
    for module in "${modules[@]}"; do
      if [ -f "$module/package.json" ]; then
        echo -e "${BLUE}📦 Установка: $module${NC}"
        (cd "$module" && npm install --silent)
      fi
    done
    echo -e "${GREEN}✅ Зависимости установлены${NC}\n"
  else
    echo -e "${RED}Запуск невозможен без установки зависимостей${NC}\n"
    exit 1
  fi
fi

# === 3. Проверка Playwright browsers ===
if [ -d "browser-control/node_modules" ]; then
  if [ ! -d "browser-control/node_modules/playwright/.local-browsers" ]; then
    echo -e "${YELLOW}⚠️  Playwright browsers не установлены${NC}"
    read -p "Установить Chromium для Playwright? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo -e "\n${BLUE}Установка Playwright Chromium...${NC}\n"
      (cd browser-control && npx playwright install chromium)
      echo -e "${GREEN}✅ Chromium установлен${NC}\n"
    fi
  fi
fi

# === 4. Меню запуска ===
echo -e "${BLUE}=== Выберите действие ===${NC}\n"
echo "1) Запустить Electron приложение"
echo "2) Запустить тесты всех модулей"
echo "3) Запустить интеграционный тест"
echo "4) Запустить демо Redis Integration"
echo "5) Запустить демо Tools"
echo "6) Выход"
echo ""
read -p "Выберите опцию (1-6): " choice

case $choice in
  1)
    echo -e "\n${BLUE}🚀 Запуск Electron приложения...${NC}\n"
    cd electron-app
    npm start
    ;;

  2)
    echo -e "\n${BLUE}🧪 Запуск тестов всех модулей...${NC}\n"

    echo -e "${BLUE}=== Electron App ===${NC}"
    (cd electron-app && node src/test-modules.js)

    echo -e "\n${BLUE}=== Coordination Module ===${NC}"
    (cd coordination && npm test)

    echo -e "\n${BLUE}=== Task Queue Module ===${NC}"
    (cd task-queue && npm test)

    echo -e "\n${BLUE}=== Browser Control ===${NC}"
    (cd browser-control && npm test)

    echo -e "\n${BLUE}=== Tools Module ===${NC}"
    (cd tools && npm test)

    echo -e "\n${BLUE}=== Redis Integration ===${NC}"
    (cd redis-integration && npm test)

    echo -e "\n${GREEN}✅ Все тесты завершены${NC}\n"
    ;;

  3)
    echo -e "\n${BLUE}🧪 Запуск интеграционного теста...${NC}\n"
    NODE_PATH=./coordination/node_modules:./task-queue/node_modules:./tools/node_modules:./redis-integration/node_modules \
      node test/integration-test.js
    ;;

  4)
    echo -e "\n${BLUE}💾 Запуск демо Redis Integration...${NC}\n"
    if ! redis-cli ping &> /dev/null; then
      echo -e "${YELLOW}⚠️  Redis не запущен. Запустите:${NC}"
      echo -e "${YELLOW}   docker run -d -p 6379:6379 redis:7-alpine${NC}\n"
      exit 1
    fi
    cd examples
    NODE_PATH=../redis-integration/node_modules node redis-demo.js
    ;;

  5)
    echo -e "\n${BLUE}🛠️  Запуск демо Tools...${NC}\n"
    cd examples
    NODE_PATH=../tools/node_modules node tools-demo.js
    ;;

  6)
    echo -e "\n${BLUE}Выход${NC}\n"
    exit 0
    ;;

  *)
    echo -e "\n${RED}❌ Неверный выбор${NC}\n"
    exit 1
    ;;
esac

echo -e "\n${GREEN}✅ Завершено${NC}\n"
