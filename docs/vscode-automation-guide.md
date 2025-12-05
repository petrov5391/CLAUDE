# Руководство по автоматизации VS Code

> **Версия документа:** 1.0
> **Дата:** 5 декабря 2025
> **Актуальность:** VS Code 1.95+

---

## Содержание

1. [Обзор возможностей автоматизации](#1-обзор-возможностей-автоматизации)
2. [Tasks (Задачи) — tasks.json](#2-tasks-задачи--tasksjson)
3. [Горячие клавиши — keybindings.json](#3-горячие-клавиши--keybindingsjson)
4. [Макросы](#4-макросы)
5. [Сниппеты (Code Snippets)](#5-сниппеты-code-snippets)
6. [Конфигурация отладки — launch.json](#6-конфигурация-отладки--launchjson)
7. [Dev Containers — devcontainer.json](#7-dev-containers--devcontainerjson)
8. [Workspace Settings (Настройки рабочего пространства)](#8-workspace-settings)
9. [Расширения для автоматизации](#9-расширения-для-автоматизации)
10. [Профили (Profiles)](#10-профили-profiles)
11. [Практические примеры](#11-практические-примеры)

---

## 1. Обзор возможностей автоматизации

VS Code предоставляет множество механизмов автоматизации:

| Механизм | Файл конфигурации | Назначение |
|----------|-------------------|------------|
| Tasks | `.vscode/tasks.json` | Автоматизация сборки, тестов, линтинга |
| Keybindings | `keybindings.json` | Кастомные горячие клавиши |
| Snippets | `*.code-snippets` / `{lang}.json` | Шаблоны кода |
| Debug | `.vscode/launch.json` | Конфигурации отладки |
| Dev Containers | `.devcontainer/devcontainer.json` | Контейнеризированная среда разработки |
| Settings | `.vscode/settings.json` | Настройки проекта/workspace |
| Extensions | `.vscode/extensions.json` | Рекомендуемые расширения |

---

## 2. Tasks (Задачи) — tasks.json

### 2.1 Что такое Tasks

Tasks позволяют запускать внешние инструменты (скрипты, компиляторы, линтеры) прямо из VS Code. Это основной механизм автоматизации рутинных операций.

### 2.2 Расположение файла

```
project/
└── .vscode/
    └── tasks.json
```

### 2.3 Создание tasks.json

**Способ 1: Через Command Palette**
1. `Ctrl+Shift+P` (или `Cmd+Shift+P` на macOS)
2. Введите `Tasks: Configure Task`
3. Выберите `Create tasks.json file from template`

**Способ 2: Вручную**
Создайте файл `.vscode/tasks.json`

### 2.4 Структура tasks.json

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build Project",
      "type": "shell",
      "command": "npm run build",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "shared"
      },
      "problemMatcher": ["$tsc"]
    }
  ]
}
```

### 2.5 Основные атрибуты задачи

| Атрибут | Описание |
|---------|----------|
| `label` | Название задачи (отображается в списке) |
| `type` | Тип: `shell` (командная строка) или `process` |
| `command` | Команда для выполнения |
| `args` | Аргументы командной строки (массив) |
| `group` | Группа: `build`, `test`, или кастомная |
| `dependsOn` | Зависимости от других задач |
| `presentation` | Настройки отображения в терминале |
| `problemMatcher` | Парсер ошибок для Problems panel |
| `runOptions` | Опции запуска |

### 2.6 Автозапуск задач при открытии проекта

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Install Dependencies",
      "type": "shell",
      "command": "npm install",
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
```

### 2.7 Составные задачи (Compound Tasks)

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Lint",
      "type": "shell",
      "command": "npm run lint"
    },
    {
      "label": "Test",
      "type": "shell",
      "command": "npm test"
    },
    {
      "label": "Full Check",
      "dependsOn": ["Lint", "Test"],
      "dependsOrder": "sequence",
      "problemMatcher": []
    }
  ]
}
```

**Параметры зависимостей:**
- `dependsOrder: "parallel"` — параллельное выполнение (по умолчанию)
- `dependsOrder: "sequence"` — последовательное выполнение

### 2.8 Переменные в tasks.json

```json
{
  "command": "echo",
  "args": [
    "Файл: ${file}",
    "Директория: ${workspaceFolder}",
    "Имя файла: ${fileBasename}"
  ]
}
```

**Доступные переменные:**

| Переменная | Описание |
|------------|----------|
| `${workspaceFolder}` | Корневая папка workspace |
| `${workspaceFolderBasename}` | Имя корневой папки |
| `${file}` | Текущий открытый файл |
| `${fileBasename}` | Имя файла без пути |
| `${fileBasenameNoExtension}` | Имя файла без расширения |
| `${fileDirname}` | Директория файла |
| `${fileExtname}` | Расширение файла |
| `${cwd}` | Текущая рабочая директория |
| `${lineNumber}` | Номер строки курсора |
| `${selectedText}` | Выделенный текст |
| `${env:VARIABLE}` | Переменная окружения |

### 2.9 Автоопределение задач

VS Code автоматически обнаруживает задачи для:
- **npm** — скрипты из `package.json`
- **Gulp** — задачи из `gulpfile.js`
- **Grunt** — задачи из `Gruntfile.js`
- **Jake** — задачи из `Jakefile`

### 2.10 Запуск задач

- `Ctrl+Shift+B` — запуск задачи по умолчанию (build)
- `Ctrl+Shift+P` → `Tasks: Run Task` — выбор задачи из списка
- `Terminal` → `Run Task...` — через меню

---

## 3. Горячие клавиши — keybindings.json

### 3.1 Доступ к настройкам

**Способ 1: GUI**
- `Ctrl+K Ctrl+S` — открыть редактор Keyboard Shortcuts

**Способ 2: JSON**
- `Ctrl+Shift+P` → `Preferences: Open Keyboard Shortcuts (JSON)`

### 3.2 Расположение файла

- **Windows:** `%APPDATA%\Code\User\keybindings.json`
- **macOS:** `$HOME/Library/Application Support/Code/User/keybindings.json`
- **Linux:** `$HOME/.config/Code/User/keybindings.json`

### 3.3 Структура keybindings.json

```json
[
  {
    "key": "ctrl+shift+t",
    "command": "workbench.action.terminal.new",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+d",
    "command": "-editor.action.addSelectionToNextFindMatch"
  }
]
```

### 3.4 Атрибуты горячей клавиши

| Атрибут | Описание |
|---------|----------|
| `key` | Комбинация клавиш |
| `command` | ID команды VS Code |
| `when` | Условие активации (контекст) |
| `args` | Аргументы для команды |

### 3.5 Модификаторы клавиш

| Windows/Linux | macOS | Обозначение в JSON |
|---------------|-------|-------------------|
| `Ctrl` | `Cmd` | `ctrl` / `cmd` |
| `Shift` | `Shift` | `shift` |
| `Alt` | `Option` | `alt` |
| `Win` | `Cmd` | `win` / `cmd` |

### 3.6 Условия (when clauses)

```json
{
  "key": "ctrl+enter",
  "command": "workbench.action.terminal.runSelectedText",
  "when": "editorTextFocus && editorHasSelection"
}
```

**Частые условия:**

| Условие | Описание |
|---------|----------|
| `editorTextFocus` | Фокус в редакторе |
| `editorHasSelection` | Есть выделение |
| `terminalFocus` | Фокус в терминале |
| `inDebugMode` | Режим отладки |
| `resourceExtname == '.py'` | Файл с расширением .py |
| `editorLangId == 'javascript'` | Язык файла JavaScript |

### 3.7 Отключение стандартных клавиш

Добавьте `-` перед командой:

```json
{
  "key": "ctrl+k",
  "command": "-editor.action.deleteLines"
}
```

### 3.8 Привязка сниппета к клавише

```json
{
  "key": "ctrl+shift+c",
  "command": "editor.action.insertSnippet",
  "when": "editorTextFocus",
  "args": {
    "snippet": "console.log('${TM_SELECTED_TEXT}$1');$0"
  }
}
```

---

## 4. Макросы

VS Code не имеет встроенной поддержки макросов, но есть расширения.

### 4.1 Расширение Macro Commander

**Установка:**
```
ext install jeff-hykin.macro-commander
```

**Настройка в settings.json:**

```json
{
  "macros": {
    "formatAndSave": [
      "editor.action.formatDocument",
      "workbench.action.files.save"
    ],
    "duplicateAndComment": [
      "editor.action.copyLinesDownAction",
      "cursorUp",
      "editor.action.addCommentLine"
    ]
  }
}
```

**Привязка к клавише:**

```json
{
  "key": "ctrl+shift+d",
  "command": "macros.formatAndSave"
}
```

### 4.2 Расширение Keyboard Macro (kb-macro)

**Установка:**
```
ext install tshino.vscode-kb-macro
```

**Использование:**
1. `Ctrl+Shift+P` → `Keyboard Macro: Start Recording`
2. Выполните действия
3. `Ctrl+Shift+P` → `Keyboard Macro: Stop Recording`
4. `Ctrl+Shift+P` → `Keyboard Macro: Playback`

**Экспорт макроса:**
- `Keyboard Macro: Copy Macro as Keybinding` — копирует записанный макрос в формате JSON для keybindings.json

### 4.3 Multi-command расширение

**Установка:**
```
ext install ryuta46.multi-command
```

**Настройка:**

```json
{
  "multiCommand.commands": [
    {
      "command": "multiCommand.saveAndFormat",
      "sequence": [
        "editor.action.formatDocument",
        "workbench.action.files.save"
      ]
    }
  ]
}
```

---

## 5. Сниппеты (Code Snippets)

### 5.1 Типы сниппетов

1. **Языковые сниппеты** — для конкретного языка (`javascript.json`)
2. **Глобальные сниппеты** — для всех языков (`*.code-snippets`)
3. **Проектные сниппеты** — в папке `.vscode/` проекта

### 5.2 Создание сниппетов

`Ctrl+Shift+P` → `Snippets: Configure User Snippets`

### 5.3 Расположение файлов

- **Windows:** `%APPDATA%\Code\User\snippets\`
- **macOS:** `$HOME/Library/Application Support/Code/User/snippets/`
- **Linux:** `$HOME/.config/Code/User/snippets/`

### 5.4 Структура сниппета

```json
{
  "Console Log": {
    "prefix": "log",
    "body": [
      "console.log('$1');",
      "$0"
    ],
    "description": "Вставить console.log"
  }
}
```

### 5.5 Атрибуты сниппета

| Атрибут | Описание |
|---------|----------|
| `prefix` | Триггер для автодополнения (строка или массив) |
| `body` | Тело сниппета (строка или массив строк) |
| `description` | Описание в автодополнении |
| `scope` | Языки (только для .code-snippets) |

### 5.6 Tabstops и Placeholders

```json
{
  "body": [
    "function ${1:name}(${2:params}) {",
    "\t${3:// body}",
    "\treturn ${4:result};",
    "}",
    "$0"
  ]
}
```

- `$1`, `$2`, `$3` — позиции табуляции (в порядке перехода)
- `${1:name}` — placeholder с значением по умолчанию
- `$0` — финальная позиция курсора

### 5.7 Выбор из списка (Choice)

```json
{
  "body": "import ${1|React,{ useState },{ useEffect }|} from 'react';"
}
```

### 5.8 Переменные в сниппетах

```json
{
  "File Header": {
    "prefix": "header",
    "body": [
      "/**",
      " * @file ${TM_FILENAME}",
      " * @author ${1:Author}",
      " * @date ${CURRENT_YEAR}-${CURRENT_MONTH}-${CURRENT_DATE}",
      " */"
    ]
  }
}
```

**Доступные переменные:**

| Переменная | Описание |
|------------|----------|
| `TM_SELECTED_TEXT` | Выделенный текст |
| `TM_CURRENT_LINE` | Текущая строка |
| `TM_CURRENT_WORD` | Слово под курсором |
| `TM_FILENAME` | Имя файла |
| `TM_FILENAME_BASE` | Имя файла без расширения |
| `TM_DIRECTORY` | Директория файла |
| `TM_FILEPATH` | Полный путь к файлу |
| `CLIPBOARD` | Содержимое буфера обмена |
| `CURRENT_YEAR` | Текущий год |
| `CURRENT_MONTH` | Текущий месяц (01-12) |
| `CURRENT_DATE` | Текущий день (01-31) |
| `CURRENT_HOUR` | Текущий час (00-23) |
| `CURRENT_MINUTE` | Текущая минута (00-59) |
| `RANDOM` | 6 случайных цифр |
| `UUID` | UUID v4 |

### 5.9 Трансформации

```json
{
  "body": "${TM_FILENAME_BASE/(.*)/${1:/pascalcase}/}"
}
```

**Модификаторы:**
- `/upcase` — ВЕРХНИЙ РЕГИСТР
- `/downcase` — нижний регистр
- `/capitalize` — Первая Заглавная
- `/camelcase` — camelCase
- `/pascalcase` — PascalCase

### 5.10 Проектные сниппеты

Создайте файл `.vscode/project.code-snippets`:

```json
{
  "Project Component": {
    "scope": "javascript,typescript",
    "prefix": "comp",
    "body": [
      "export function ${1:ComponentName}() {",
      "\treturn (",
      "\t\t<div>$0</div>",
      "\t);",
      "}"
    ]
  }
}
```

---

## 6. Конфигурация отладки — launch.json

### 6.1 Расположение

```
project/
└── .vscode/
    └── launch.json
```

### 6.2 Создание launch.json

1. Откройте панель Run and Debug (`Ctrl+Shift+D`)
2. Нажмите `create a launch.json file`
3. Выберите среду (Node.js, Python, etc.)

### 6.3 Базовая структура

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Program",
      "program": "${workspaceFolder}/app.js"
    }
  ]
}
```

### 6.4 Обязательные атрибуты

| Атрибут | Описание |
|---------|----------|
| `type` | Тип отладчика (`node`, `python`, `go`, `cppdbg`, etc.) |
| `request` | `launch` (запуск) или `attach` (подключение) |
| `name` | Название конфигурации |

### 6.5 Общие атрибуты

| Атрибут | Описание |
|---------|----------|
| `program` | Путь к исполняемому файлу |
| `args` | Аргументы командной строки |
| `env` | Переменные окружения |
| `cwd` | Рабочая директория |
| `port` | Порт для подключения |
| `preLaunchTask` | Задача для выполнения перед запуском |
| `postDebugTask` | Задача после завершения отладки |
| `console` | Тип консоли |

### 6.6 Примеры конфигураций

**Node.js:**
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Node.js",
  "program": "${workspaceFolder}/src/index.js",
  "env": {
    "NODE_ENV": "development"
  },
  "preLaunchTask": "npm: build"
}
```

**Python:**
```json
{
  "type": "debugpy",
  "request": "launch",
  "name": "Debug Python",
  "program": "${file}",
  "console": "integratedTerminal",
  "args": ["--verbose"]
}
```

**Go:**
```json
{
  "type": "go",
  "request": "launch",
  "name": "Debug Go",
  "mode": "auto",
  "program": "${workspaceFolder}/main.go"
}
```

**Attach to Process:**
```json
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Process",
  "port": 9229
}
```

### 6.7 Составные конфигурации (Compounds)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Server",
      "program": "${workspaceFolder}/server/index.js"
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Client",
      "url": "http://localhost:3000"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack",
      "configurations": ["Server", "Client"],
      "stopAll": true
    }
  ]
}
```

### 6.8 Автооткрытие URL при готовности сервера

```json
{
  "type": "node",
  "request": "launch",
  "name": "Launch Server",
  "program": "${workspaceFolder}/server.js",
  "serverReadyAction": {
    "pattern": "listening on port ([0-9]+)",
    "uriFormat": "http://localhost:%s",
    "action": "openExternally"
  }
}
```

---

## 7. Dev Containers — devcontainer.json

### 7.1 Что такое Dev Containers

Dev Containers позволяют использовать Docker-контейнер как полноценную среду разработки с предустановленными инструментами и зависимостями.

### 7.2 Требования

- Docker Desktop (или Docker Engine на Linux)
- Расширение VS Code: `ms-vscode-remote.remote-containers`

### 7.3 Структура файлов

```
project/
└── .devcontainer/
    ├── devcontainer.json
    └── Dockerfile (опционально)
```

### 7.4 Создание конфигурации

`Ctrl+Shift+P` → `Dev Containers: Add Dev Container Configuration Files...`

### 7.5 Базовый devcontainer.json

```json
{
  "name": "Node.js Development",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:18",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode"
      ],
      "settings": {
        "editor.formatOnSave": true
      }
    }
  },
  "forwardPorts": [3000],
  "postCreateCommand": "npm install",
  "remoteUser": "node"
}
```

### 7.6 Основные атрибуты

| Атрибут | Описание |
|---------|----------|
| `name` | Название контейнера |
| `image` | Docker образ |
| `build` | Настройки сборки (если используется Dockerfile) |
| `features` | Dev Container Features |
| `customizations` | Настройки VS Code |
| `forwardPorts` | Проброс портов |
| `postCreateCommand` | Команда после создания контейнера |
| `postStartCommand` | Команда при каждом старте |
| `remoteUser` | Пользователь в контейнере |
| `mounts` | Дополнительные монтирования |

### 7.7 Использование Dockerfile

```json
{
  "name": "Custom Container",
  "build": {
    "dockerfile": "Dockerfile",
    "context": "..",
    "args": {
      "NODE_VERSION": "18"
    }
  }
}
```

### 7.8 Docker Compose

```json
{
  "name": "Full Stack App",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace"
}
```

### 7.9 Dev Container Features

Features — готовые модули для добавления инструментов:

```json
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": {
      "version": "18"
    },
    "ghcr.io/devcontainers/features/python:1": {
      "version": "3.11"
    },
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  }
}
```

### 7.10 Lifecycle Scripts

```json
{
  "initializeCommand": "echo 'Preparing...'",
  "onCreateCommand": "npm ci",
  "updateContentCommand": "npm install",
  "postCreateCommand": "npm run setup",
  "postStartCommand": "npm run dev",
  "postAttachCommand": "echo 'Ready!'"
}
```

---

## 8. Workspace Settings

### 8.1 Уровни настроек

1. **User Settings** — глобальные для пользователя
2. **Workspace Settings** — для проекта (`.vscode/settings.json`)
3. **Folder Settings** — для папки в multi-root workspace

### 8.2 Файл .vscode/settings.json

```json
{
  "editor.tabSize": 2,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.exclude": {
    "**/node_modules": true,
    "**/.git": true
  },
  "search.exclude": {
    "**/dist": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  }
}
```

### 8.3 Рекомендуемые расширения — extensions.json

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ],
  "unwantedRecommendations": [
    "ms-vscode.vscode-typescript-tslint-plugin"
  ]
}
```

### 8.4 Локальные расширения workspace (с апреля 2024)

Расширения можно размещать прямо в проекте:

```
project/
└── .vscode/
    └── extensions/
        └── my-extension/
            ├── package.json
            └── extension.js
```

### 8.5 Multi-root Workspace

Файл `project.code-workspace`:

```json
{
  "folders": [
    {"path": "frontend"},
    {"path": "backend"},
    {"path": "shared"}
  ],
  "settings": {
    "editor.formatOnSave": true
  },
  "extensions": {
    "recommendations": ["esbenp.prettier-vscode"]
  }
}
```

---

## 9. Расширения для автоматизации

### 9.1 Code Runner
- **ID:** `formulahendry.code-runner`
- **Функция:** Запуск кода одной клавишей

### 9.2 Auto Run Command
- **ID:** `gabrielgrinberg.auto-run-command`
- **Функция:** Автозапуск команд при событиях

### 9.3 File Watcher
- **ID:** `appulate.filewatcher`
- **Функция:** Запуск команд при изменении файлов

```json
{
  "filewatcher.commands": [
    {
      "match": "\\.scss$",
      "cmd": "npm run compile:scss",
      "event": "onSave"
    }
  ]
}
```

### 9.4 Task Runner
- **ID:** `SanaAjani.taskrunnercode`
- **Функция:** Удобный интерфейс для задач

### 9.5 Trigger Task on Save
- **ID:** `Gruntfuggly.triggertaskonsave`
- **Функция:** Запуск задач при сохранении

```json
{
  "triggerTaskOnSave.tasks": {
    "build": ["src/**/*.ts"]
  }
}
```

### 9.6 Run on Save
- **ID:** `emeraldwalk.RunOnSave`
- **Функция:** Выполнение команд при сохранении

```json
{
  "emeraldwalk.runonsave": {
    "commands": [
      {
        "match": "\\.py$",
        "cmd": "black ${file}"
      }
    ]
  }
}
```

---

## 10. Профили (Profiles)

### 10.1 Что такое профили

Профили позволяют иметь разные наборы настроек, расширений и сниппетов для разных задач.

### 10.2 Создание профиля

1. `Ctrl+Shift+P` → `Profiles: Create Profile`
2. Выберите, что включить:
   - Settings
   - Keyboard Shortcuts
   - Snippets
   - User Tasks
   - Extensions

### 10.3 Переключение профилей

- Через меню: `File` → `Preferences` → `Profiles`
- Через Command Palette: `Profiles: Switch Profile`

### 10.4 Экспорт/Импорт профилей

- `Profiles: Export Profile` — экспорт в файл или GitHub Gist
- `Profiles: Import Profile` — импорт из файла или URL

### 10.5 Привязка профиля к папке

```json
// В settings.json папки
{
  "workbench.settings.applyDefaultProfile": "Python Dev"
}
```

---

## 11. Практические примеры

### 11.1 Полная автоматизация Frontend проекта

**.vscode/tasks.json:**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev",
      "type": "npm",
      "script": "dev",
      "isBackground": true,
      "problemMatcher": []
    },
    {
      "label": "lint:fix",
      "type": "shell",
      "command": "npm run lint -- --fix"
    },
    {
      "label": "test:watch",
      "type": "npm",
      "script": "test:watch",
      "isBackground": true
    },
    {
      "label": "Full Dev Environment",
      "dependsOn": ["dev", "test:watch"],
      "dependsOrder": "parallel",
      "runOptions": {
        "runOn": "folderOpen"
      }
    }
  ]
}
```

**.vscode/settings.json:**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 11.2 Python проект с виртуальным окружением

**.vscode/tasks.json:**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Setup venv",
      "type": "shell",
      "command": "python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt",
      "windows": {
        "command": "python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements.txt"
      }
    },
    {
      "label": "Run tests",
      "type": "shell",
      "command": "${workspaceFolder}/.venv/bin/pytest",
      "windows": {
        "command": "${workspaceFolder}\\.venv\\Scripts\\pytest"
      },
      "group": {
        "kind": "test",
        "isDefault": true
      }
    }
  ]
}
```

**.vscode/launch.json:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Python: Current File",
      "type": "debugpy",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal",
      "env": {
        "PYTHONPATH": "${workspaceFolder}"
      }
    }
  ]
}
```

### 11.3 Полный Dev Container для Full-Stack

**.devcontainer/devcontainer.json:**
```json
{
  "name": "Full Stack Dev",
  "dockerComposeFile": "docker-compose.yml",
  "service": "app",
  "workspaceFolder": "/workspace",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {"version": "20"},
    "ghcr.io/devcontainers/features/python:1": {"version": "3.11"},
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-python.python",
        "bradlc.vscode-tailwindcss"
      ],
      "settings": {
        "editor.formatOnSave": true
      }
    }
  },
  "forwardPorts": [3000, 5000, 5432],
  "postCreateCommand": "npm install && pip install -r requirements.txt",
  "remoteUser": "vscode"
}
```

---

## Источники и ссылки

- [VS Code Tasks Documentation](https://code.visualstudio.com/docs/debugtest/tasks)
- [VS Code Keybindings](https://code.visualstudio.com/docs/configure/keybindings)
- [VS Code Snippets](https://code.visualstudio.com/docs/editing/userdefinedsnippets)
- [VS Code Debugging](https://code.visualstudio.com/docs/debugtest/debugging)
- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [Create a Dev Container](https://code.visualstudio.com/docs/devcontainers/create-dev-container)
- [Macro Commander Extension](https://github.com/jeff-hykin/macro-commander)
- [KB Macro Extension](https://github.com/tshino/vscode-kb-macro)
- [VS Code API - Task Provider](https://code.visualstudio.com/api/extension-guides/task-provider)
