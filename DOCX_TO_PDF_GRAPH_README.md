# Conversão DOCX -> PDF via Microsoft Graph

## Visão geral
Este fluxo converte DOCX para PDF com alta fidelidade usando o Microsoft Graph, sem binários locais. A conversão é feita em memória e os arquivos temporários são removidos do drive após a conversão.

## Configuração no Azure AD
1) Crie um App Registration no Azure AD.
2) Gere um client secret.
3) Conceda permissões de aplicação:
   - Files.ReadWrite.All
   - Sites.ReadWrite.All (se usar SharePoint)
4) Faça o admin consent das permissões.
5) Separe um usuário/drive para armazenar arquivos temporários.

## Variáveis de ambiente (Vercel ou local)
- MS_TENANT_ID
- MS_CLIENT_ID
- MS_CLIENT_SECRET
- MS_GRAPH_USER_ID (opcional se usar drive ID)
- MS_GRAPH_DRIVE_ID (opcional se usar drive específico)
- MS_GRAPH_TEMP_FOLDER (exemplo: solarinvest-temp-contracts)
- MS_GRAPH_BASE_PATH (opcional, exemplo: Contracts/Temp)
- MS_GRAPH_SCOPE (fixo: https://graph.microsoft.com/.default)

## Endpoint
POST /api/pdf/convert-docx

### Multipart
Envie multipart/form-data com o arquivo DOCX.

### JSON (opcional)
Envie application/json com:
- docxBase64
- fileName (opcional)

## Teste local (manual)
1) Defina as variáveis de ambiente acima.
2) Suba o servidor local.
3) Faça um POST para /api/pdf/convert-docx com um DOCX.

## Integração com contratos
A geração de contratos já chama a conversão via Microsoft Graph internamente, sem arquivos persistentes no repositório.
