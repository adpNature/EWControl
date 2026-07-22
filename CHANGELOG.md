# [1.13.0](https://github.com/adpNature/EWControl/compare/v1.12.0...v1.13.0) (2026-07-22)

### Features

- implementa landing page pública de bienvenida (spec 17) ([d6a7b50](https://github.com/adpNature/EWControl/commit/d6a7b508f9f8db49945bf422ddbfde173e6018b4))

# [1.12.0](https://github.com/adpNature/EWControl/compare/v1.11.0...v1.12.0) (2026-07-22)

### Features

- pulido visual y UX de la plataforma (spec 16) ([5ca5013](https://github.com/adpNature/EWControl/commit/5ca50134e88d3dc56fb0951c03cfbe5a24d71354))

# [1.11.0](https://github.com/adpNature/EWControl/compare/v1.10.0...v1.11.0) (2026-07-18)

### Features

- **observabilidad:** implementa health checks, métricas y alerting de infraestructura (spec 15) ([8b27167](https://github.com/adpNature/EWControl/commit/8b27167d4811a9f6782926e862f3a90e0b708d06))

# [1.10.0](https://github.com/adpNature/EWControl/compare/v1.9.0...v1.10.0) (2026-07-17)

### Features

- **historicos:** implementa comparativa multi-Signal/Machine (spec 14) ([c174fcf](https://github.com/adpNature/EWControl/commit/c174fcf47130f776330190c18142e6dcbc12d3a5))

# [1.9.0](https://github.com/adpNature/EWControl/compare/v1.8.0...v1.9.0) (2026-07-16)

### Features

- **signal-engine:** implementa el motor de fórmulas para Signals FORMULA (spec 13) ([e1ab316](https://github.com/adpNature/EWControl/commit/e1ab3169a48d9ac6b9041234e4db490dcfb3cec9))

# [1.8.0](https://github.com/adpNature/EWControl/compare/v1.7.2...v1.8.0) (2026-07-15)

### Bug Fixes

- **alarms:** fix GET /alarm-states 500 (bad query builder joins/orderBy) ([5709194](https://github.com/adpNature/EWControl/commit/57091945c7a9d9a77d92be938209490d51aea230))
- **auth:** reuse SEED_USER_PASSWORD constant instead of hardcoded literal in tests ([9dd9d75](https://github.com/adpNature/EWControl/commit/9dd9d759e2661c2db5056af7c811e24d0b8f85c1))
- **auth:** show rate-limit message on forgot-password 429 ([6ed3956](https://github.com/adpNature/EWControl/commit/6ed39569d26e82483d484d5f5a406fc24cedb03c))
- **ci:** el retry del backend en e2e no abortaba, y Release exige Node 22 ([6e256d4](https://github.com/adpNature/EWControl/commit/6e256d4475addd232504db246c145fd2456ae22c))
- **ci:** retry loop del E2E no reintentaba, y Release exige Node 22 ([fd6c2e1](https://github.com/adpNature/EWControl/commit/fd6c2e185e136c9a9c61e0e7e039302fdebed934))
- **users:** add mandatory Company selector to new-user form for SuperAdmin ([41e8370](https://github.com/adpNature/EWControl/commit/41e8370928b74944ed6de6b76d35eacf4d7b828b))

### Features

- **alarms:** add Alarm Engine evaluation (spec 09, slice 2/5) ([e734606](https://github.com/adpNature/EWControl/commit/e7346068c9a1b466dfa16bf508cb57938e016bf9))
- **alarms:** add AlarmDefinition CRUD (spec 09, slice 1/5) ([45f8d85](https://github.com/adpNature/EWControl/commit/45f8d85f8788a2284451062ed5253865e4b08f37))
- **alarms:** add AlarmState read and panel (spec 09, slice 3/5) ([245596d](https://github.com/adpNature/EWControl/commit/245596d25610718b6f406854c53b22a69739ad94))
- **alarms:** add email notification service (spec 09, slice 4/5) ([093efb0](https://github.com/adpNature/EWControl/commit/093efb0bec00365f5d6c717df56dcde1e6b6dfd3))
- **alarms:** add manual acknowledgement (ACK) for alarms (spec 11) ([cf1ea6c](https://github.com/adpNature/EWControl/commit/cf1ea6c89b6d0bf5cc09f1641b62e5a5aa0c603b))
- **alarms:** implement ALARM_LIST widget with live updates (spec 09, slice 5/5) ([a8bf2a0](https://github.com/adpNature/EWControl/commit/a8bf2a0bed3442f0377d311124875b6f3c95d2ac))
- **auth:** add forgot-password/reset-password recovery flow (spec 10, slice 5/5) ([76813d4](https://github.com/adpNature/EWControl/commit/76813d4853af92931f41b5546b036b7343e04f23))
- **auth:** add RolesGuard and seed a demo SuperAdmin user (spec 10, slice 1/5) ([c5a5bd0](https://github.com/adpNature/EWControl/commit/c5a5bd02064d04401f0cf4dd696e9c4affd4c7bd))
- **auth:** add self-service password change (spec 10, slice 4/5) ([5ee38a0](https://github.com/adpNature/EWControl/commit/5ee38a06353eebd11b12cb0da00361f2f4e4fee9))
- **companies:** add Company CRUD, SuperAdmin only (spec 10, slice 2/5) ([a12479b](https://github.com/adpNature/EWControl/commit/a12479bc518f91b79e0a2aac40dd07ee35e78eb5))
- **companies:** add reactivate and permanent delete for Company, reactivate for User (spec 10) ([5b38f5b](https://github.com/adpNature/EWControl/commit/5b38f5bdc4fe65393b75e48d72b83517dd620815))
- implementa navegación y shell de la zona privada (spec 12) ([22f9d23](https://github.com/adpNature/EWControl/commit/22f9d23755363501667a49c934324ad1f4e2cf5a))
- **users:** add User CRUD with per-company isolation (spec 10, slice 3/5) ([39da9a8](https://github.com/adpNature/EWControl/commit/39da9a82180f069dce4bb358cf285b55058cf70f))

## [1.7.2](https://github.com/adpNature/EWControl/compare/v1.7.1...v1.7.2) (2026-07-13)

### Bug Fixes

- **frontend:** restaura la entrada de ws@8.21.0 en pnpm-lock.yaml ([90c220c](https://github.com/adpNature/EWControl/commit/90c220ceae0ede1f3cdc3ff946323691641ee073))

## [1.7.1](https://github.com/adpNature/EWControl/compare/v1.7.0...v1.7.1) (2026-07-13)

### Bug Fixes

- **ci:** usa Variables en vez de Secrets para el JWT de test ([2a18f85](https://github.com/adpNature/EWControl/commit/2a18f85bd054bed33868909b1f2b2e1db57e322e))

# [1.7.0](https://github.com/adpNature/EWControl/compare/v1.6.0...v1.7.0) (2026-07-12)

### Features

- implementa históricos (spec 08) ([1619d25](https://github.com/adpNature/EWControl/commit/1619d25af7037952d056a27e139e475971ff6dc1))

# [1.6.0](https://github.com/adpNature/EWControl/compare/v1.5.0...v1.6.0) (2026-07-12)

### Bug Fixes

- aisla specs de Vitest para evitar fugas de estado en CI ([059cecc](https://github.com/adpNature/EWControl/commit/059cecc7f19c070ddb486b6de8b5ea43429b6ef1))
- estabiliza el test de RealtimeSocketService en CI ([0bb578e](https://github.com/adpNature/EWControl/commit/0bb578e616acaff17aadeb58b4afb82901049dc9))
- estabiliza el test de RealtimeSocketService en CI ([4a8ae08](https://github.com/adpNature/EWControl/commit/4a8ae082311c503bb18fce24a888c5ea3fcb2cb6))

### Features

- implementa Dashboard en tiempo real (spec 07) ([0c04cbf](https://github.com/adpNature/EWControl/commit/0c04cbff33756a2c27ecaaa72a0888ac04f1d760))

# [1.5.0](https://github.com/adpNature/EWControl/compare/v1.4.0...v1.5.0) (2026-07-10)

### Features

- implementa gestión de Machines y Signals (spec 06) ([22868fc](https://github.com/adpNature/EWControl/commit/22868fccae0677183f07534cc90e35cbd89bcbb6))

# [1.4.0](https://github.com/adpNature/EWControl/compare/v1.3.0...v1.4.0) (2026-07-10)

### Bug Fixes

- corrige fallos de CI en la spec de autenticación (secretos JWT y falso positivo de GitGuardian) ([77d65b5](https://github.com/adpNature/EWControl/commit/77d65b55f557f964646c303ea8936b442f915e42))
- mueve secretos JWT de CI a GitHub Actions Secrets ([0b95945](https://github.com/adpNature/EWControl/commit/0b95945f38f92f79a054291abd920820c2cb7dac))

### Features

- implementa autenticación de usuario (spec 05) ([fa210b6](https://github.com/adpNature/EWControl/commit/fa210b65f0cf9cc922825e932326bb34cbd833a7))

# [1.3.0](https://github.com/adpNature/EWControl/compare/v1.2.0...v1.3.0) (2026-07-09)

### Bug Fixes

- agrega servicio InfluxDB a CI para spec 04 ([1d451b4](https://github.com/adpNature/EWControl/commit/1d451b4395738922790cb65bc7f81085fc42891a))

### Features

- implementa pre-poblado de histórico del simulador (spec 04) ([7389930](https://github.com/adpNature/EWControl/commit/7389930be81691b8d873af877e8de1ab53aa1a28))

# [1.2.0](https://github.com/adpNature/EWControl/compare/v1.1.0...v1.2.0) (2026-07-08)

### Features

- implementa endpoints para forzar fallo del simulador (spec 03) ([16ae669](https://github.com/adpNature/EWControl/commit/16ae6695b30b3cc5950fa5f347ba957256dc21e8))

# [1.1.0](https://github.com/adpNature/EWControl/compare/v1.0.2...v1.1.0) (2026-07-08)

### Features

- implementa generacion de lectura simulada de una Signal (spec 02) ([564a82b](https://github.com/adpNature/EWControl/commit/564a82b18c80763df4d6660d4fe162b22cfe367d))

## [1.0.2](https://github.com/adpNature/EWControl/compare/v1.0.1...v1.0.2) (2026-07-08)

### Bug Fixes

- adapta tsconfig del backend a los nuevos defaults de TypeScript 6 ([545312a](https://github.com/adpNature/EWControl/commit/545312abfe2343f64f8ea84de53efc5560921844))

## [1.0.1](https://github.com/adpNature/EWControl/compare/v1.0.0...v1.0.1) (2026-07-08)

### Bug Fixes

- resuelve fallos de CI en PRs de Dependabot ([0d7f022](https://github.com/adpNature/EWControl/commit/0d7f02295336ba2fdf76912d7902466ce50d3648))

# 1.0.0 (2026-07-08)

### Features

- implementa la fundacion del entorno demo (Company, User, Machine, Signals) ([5bc6c03](https://github.com/adpNature/EWControl/commit/5bc6c03752b32f2ff9c6a668e63359b6050ff6b2))
