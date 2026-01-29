# Contributing — SolarInvest App

Este documento define as regras obrigatórias para evitar regressões em produção.

## 1. Princípios Arquiteturais
- App.tsx é um leaf: nunca deve ser importado por outros módulos.
- Separação clara de camadas:
  - shared/domain: código puro
  - stores/contexts: estado
  - services: orquestração
  - ui: componentes e páginas

## 2. Regras Anti-TDZ (Obrigatórias)
- Hooks devem seguir ordem top-down.
- Nenhum useCallback/useMemo pode depender de algo declarado abaixo.
- Nenhum hook pode conter auto-referência no dependency array.
- Preferir function declaration para helpers.

## 3. JSX Seguro
- Nenhum JSX pode referenciar variáveis inexistentes.
- Após refactors, validar mensagens condicionais e banners.

## 4. Import Circular
Antes de PR grande, executar:
```
npx madge --circular src --extensions ts,tsx
```
Não é permitido merge com ciclos críticos.

## 5. Build e Deploy
Comandos obrigatórios antes de merge:
```
npm run lint:cycles
npm run build
```

- Não usar npm install --force.
- legacy-peer-deps é permitido enquanto React 18 estiver ativo.

## 6. Definition of Done (DoD)
- Build de produção passa.
- Sem erros TDZ ou ReferenceError.
- Sem ciclos críticos.
- Código estável após minificação.

---
Se este checklist não for seguido, o PR não deve ser mergeado.
