MAPA COMERCIAL BRASIL - FEISHU BASE (VERSAO ESTATICA)

Esta versão não exige Node.js/npm no computador do usuário.
Arquivos: index.html, main.js e style.css.

Campos esperados no Feishu Base:
Obrigatórios: uf_destino, receita, pedidos
Opcionais: Pedidos_5kg, ano, mes, executivo, time

Ticket médio consolidado por UF = SUM(receita) / SUM(pedidos).

PUBLICACAO SEM INSTALAR NADA:
1. Crie um repositório no GitHub pelo navegador.
2. Faça upload dos três arquivos desta pasta para a raiz do repositório.
3. Ative GitHub Pages em Settings > Pages, publicando a branch principal pela raiz (/).
4. Aguarde a URL HTTPS do Pages ficar disponível.
5. No Feishu Base, adicione a URL HTTPS como extensão/plugin personalizado conforme as opções disponíveis na sua organização.

IMPORTANTE:
- O JavaScript SDK do Feishu é carregado via CDN (esm.sh).
- Leaflet é carregado via jsDelivr.
- O GeoJSON das UFs é carregado via jsDelivr/GitHub.
- Se a política de rede corporativa bloquear algum CDN, será necessário hospedar essas dependências junto com o projeto.
- O plugin precisa ser aberto dentro do ambiente de extensão do Feishu para o SDK conseguir acessar a Base.
