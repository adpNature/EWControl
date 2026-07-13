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
