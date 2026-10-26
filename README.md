# Selah · Devocionais diários

Protótipo visual responsivo em React + TypeScript + Vite.

## Executar

As dependências já estão instaladas neste projeto. Para abrir o aplicativo:

```sh
npm run dev
```

Acesse o endereço local exibido pelo Vite, normalmente http://localhost:5173.
No PowerShell, se houver problemas com o script npm.ps1, use `npm.cmd run dev`.
Em uma instalação nova do repositório, execute `npm ci` antes de iniciar.

## Verificações

```sh
npm run build
npm run lint
npm run test:run
```

## Telas e comportamento

- `#inicio`: destaque do devocional do dia e recomendações.
- `#historico`: acervo com busca e filtros de temas.
- `#leitura`: texto bíblico, reflexão, pergunta e marcação de leitura por sessão.
- `#cadastro`: nome completo, celular com DDD, idade, Instagram opcional, e-mail, senha e confirmação.
- `#login`: e-mail e senha, com validação visual.
- `#admin`: indicadores fictícios e inclusão, edição e remoção de devocionais em memória. O último item do acervo é preservado.

O cadastro e o login apenas validam campos, sem criar contas ou autenticar usuários.
Use dados fictícios. Nenhum dado de formulário é enviado, registrado ou persistido pelo aplicativo.
Campos são limpos após uma validação bem-sucedida e descartados ao sair da tela.
O navegador pode ter seus próprios recursos de preenchimento automático.

O acervo apresenta uma edição demonstrativa fixa de 23 de outubro de 2026.
Alterações administrativas e marcações de leitura são perdidas ao recarregar a página.
O painel é público neste protótipo. A interface não utiliza banco de dados, armazenamento local ou serviços externos. Há arquivos preparatórios de Supabase separados, ainda sem integração com os componentes.

## Processo de engenharia

As regras permanentes estão em [AGENTS.md](AGENTS.md). Consulte o [fluxo de desenvolvimento e publicação](docs/development-workflow.md) e o [inventário de testes e lacunas](docs/testing.md). `npm test` inicia o modo de observação do Vitest. Publicações e alterações em banco de produção exigem autorização explícita.

## Estrutura

- `src/App.tsx`: layout, navegação por hash e estado da sessão.
- `src/components/UI.tsx`: ícones, cabeçalhos e cards reutilizáveis.
- `src/components/AuthForm.tsx`: formulários e validações acessíveis.
- `src/components/AdminPanel.tsx`: gerenciamento demonstrativo de conteúdo.
- `src/data/devotionals.ts`: tipos e acervo de exemplo.
- `src/index.css` e `src/App.css`: estilos globais e layout responsivo.

As ilustrações usam CSS e os ícones usam SVG local, sem requisições externas.
Os textos bíblicos usam a tradução Almeida de 1911; as reflexões são conteúdos de demonstração.
