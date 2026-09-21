Feishu Mapa Comercial Brasil — V6 Dashboard

Objetivo: usar como plugin personalizado dentro do Dashboard do Feishu Base.

Instalação:
1. Substitua index.html, main.js e style.css no GitHub Pages.
2. No Feishu, abra o Dashboard desejado.
3. Adicionar componente > Mais > Adicionar plugin personalizado.
4. Informe a URL do GitHub Pages.

V6:
- layout responsivo para blocos do Dashboard;
- sem painel de diagnóstico visível;
- mantém mapa por UF, KPIs, filtros e ticket médio ponderado;
- recalcula o Leaflet ao redimensionar o bloco;
- detecta contexto de Dashboard para diagnóstico interno no console.

Observação: esta é a primeira versão de migração para o ponto de extensão Dashboard. Se o Feishu bloquear leitura direta da Base no estado Create/Config, a mensagem de erro exibida permitirá adaptar a próxima versão ao módulo Dashboard/getPreviewData.
