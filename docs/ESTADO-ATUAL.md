# Estado atual do Diário de Leitura

Atualizado em 22/11/2026 a partir do código presente no workspace. O primeiro build Android de preview registrado é anterior às últimas mudanças e não deve ser considerado o APK atualizado para o próximo beta.

## Resumo

O Diário de Leitura é um app móvel Expo/React Native para manter uma biblioteca pessoal, registrar progresso e notas, organizar livros em estantes personalizadas e consultar estatísticas. Os dados ficam no aparelho. Não há conta, backend ou sincronização em nuvem.

- Android package / iOS bundle ID: `com.folio.diariodeleitura`.
- Projeto EAS: `@marxs-team/diario-leitura`, ID `69ec23fb-8ad1-4777-9b8a-89f44d9cc7fb`.
- Perfil `preview`: distribuição interna como APK Android.
- Primeiro build de referência: [página no EAS](https://expo.dev/accounts/marxs-team/projects/diario-leitura/builds/50c07104-9e6a-41d6-a93a-7543c221fea0). O código mudou desde esse build; é necessário gerar outro APK antes de distribuir a versão atual.
- Não há confirmação registrada de uma rodada completa de testes manuais da versão atual em aparelho.

## Funcionalidades implementadas

### Biblioteca e leitura

- Cadastro manual e pesquisa online na Google Books API.
- Biblioteca horizontal de capas, filtros por status e ano; tocar na capa abre os detalhes.
- Capas de livros avaliados exibem a nota de 0,5 a 5 estrelas, em intervalos de meia estrela, em uma cápsula abaixo da capa na biblioteca.
- Início e conclusão da leitura com seletor visual de data.
- Progresso por página e seção “Em andamento”.
- Edição de dados do livro, status/progresso, formato físico ou Kindle e avaliação opcional de 0,5 a 5 estrelas, em intervalos de meia estrela.
- Capas pessoais, com escolha pela biblioteca de imagens.

### Estantes personalizadas

- Criar, editar e excluir estantes.
- Um livro pode pertencer a mais de uma estante.
- Personalização por nome, cor, símbolo ou imagem escolhida pela pessoa.
- A tela de cada estante mostra os livros associados.

### Notas, estatísticas e perfil

- Criar, editar e excluir notas por livro, com número de página opcional.
- Estatísticas anuais e mapa de atividade por páginas lidas diariamente.
- Perfil com nome, avatar, forma de tratamento, meta anual e quatro temas: Clássico, Bruxas, Espacial e Flores. Cada tema usa uma imagem local nos cabeçalhos principais e no seletor visual do perfil.

### Backup

- Exportação e restauração manual por arquivo na tela de perfil.
- O arquivo contém biblioteca, notas, atividade de leitura, estantes, avaliações, formato, perfil e imagens locais.
- Backups antigos sem os campos mais recentes são aceitos com valores padrão. A restauração substitui os dados locais atuais; fazer uma cópia do arquivo antes de restaurar.
- O backup tem limite de 50 MB.

## Tecnologias e arquitetura

- Expo SDK 58, React Native 0.88.1, React 19.3.0 e TypeScript 6.0.3.
- Expo Router para navegação; Expo SQLite para persistência local.
- `expo-image` para imagens e `expo-image-picker` para escolher capas, avatar e ícones.
- Google Books API para pesquisa opcional; busca requer rede e chave configurada. Cadastro manual permanece disponível sem rede.

Principais arquivos:

| Arquivo | Responsabilidade |
| --- | --- |
| `src/app/_layout.tsx` | Inicializa SQLite e navegação raiz. |
| `src/app/index.tsx` | Biblioteca horizontal, filtros e atalhos. |
| `src/app/in-progress.tsx` | Livros em andamento e registro de página. |
| `src/app/shelves.tsx` | Lista, detalhe, edição e personalização das estantes. |
| `src/app/add-book.tsx` | Pesquisa e cadastro de livros. |
| `src/app/book/[id].tsx` | Detalhe do livro, avaliação e notas. |
| `src/app/book/edit/[id].tsx` | Edição de dados, datas, formato, avaliação e progresso. |
| `src/app/stats.tsx` | Estatísticas e mapa anual de páginas. |
| `src/app/profile.tsx` | Perfil, temas e operações de backup. |
| `src/components/theme-scene-header.tsx` | Cabeçalhos com imagens, contraste e identidade visual por tema. |
| `src/components/rating-stars.tsx` | Exibição e seleção acessível de avaliações em intervalos de meia estrela. |
| `src/constants/reader-theme-artwork.ts` | Imagens locais e descrições acessíveis de cada tema. |
| `src/providers/reader-profile.tsx` | Estado compartilhado e operações do perfil de leitura. |
| `src/db/books.ts` | Tipos, tabelas, migrações e operações SQLite. |
| `src/services/google-books.ts` | Consulta e normalização da Google Books API. |
| `src/services/local-images.ts` | Armazenamento de imagens e backup/restauração. |
| `src/constants/reader-themes.ts` | Paletas dos temas. |

O banco contém `books`, `reader_profile`, `reading_notes`, `reading_activity`, `reading_shelves` e `reading_shelf_books`. Migrações adicionam campos novos a bancos já existentes.

## Armazenamento e limites

Os dados e fotos são armazenados no espaço privado do app. Não há login, sincronização ou recuperação remota. Perder o aparelho ou desinstalar o app pode apagar a biblioteca se não existir backup exportado.

A busca transmite à Google o termo de título/autor e usa uma chave incluída no cliente por ter o prefixo `EXPO_PUBLIC_`; essa chave não é secreta. Restrinja-a à API, apps e cotas apropriadas. Notas, perfil e biblioteca não são enviados pela busca.

## Verificações e pendências

- `npx tsc --noEmit` e `npx expo lint` passaram em 22/11/2026.
- Em 22/11/2026, `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor` (20/20 verificações) e `npx expo export --platform android` passaram após alinhar as dependências Expo ao SDK 58.
- A inspeção local do arquivo EAS confirmou que os componentes e imagens necessários estão incluídos, que `.env.local` e `node_modules` ficam de fora e que a variável Google Books está configurada no ambiente remoto `preview`.
- `npm audit` apontou 9 entradas moderadas associadas ao aviso GHSA de negação de serviço em `minimatch`: 3 no grafo de produção e 6 em ferramentas de desenvolvimento. O caminho de produção passa por `expo` → `@expo/fingerprint` → `minimatch`. A correção automática sugerida pelo npm rebaixaria o Expo para SDK 52; por isso, nenhuma correção automática foi aplicada.
- Não há suíte automatizada de testes configurada.
- As imagens e respectivas fontes/licenças estão documentadas em [ASSETS-TEMAS.md](./ASSETS-TEMAS.md).
- Gerar um APK de preview e executar o roteiro de [BETA.md](./BETA.md) em Android, incluindo meia estrela e backup/restauração.
- Confirmar visualmente o alinhamento dos símbolos e o branding “Powered by Google” em aparelho.
- Corrigir problemas encontrados e fazer uma rodada com poucos amigos, avisando sobre armazenamento local e exportação manual.
- Teste e build iOS ficam para quando houver necessidade de distribuição para iPhone e credenciais Apple configuradas.
- Reordenação manual por arrastar permanece como ideia futura.
- Antes de eventual publicação em lojas, revisar privacidade, licença, requisitos de loja e regras vigentes de marca/API.

## Build

```powershell
npx eas-cli@latest build --platform android --profile preview
```

O resultado “build concluído” confirma a geração do pacote, não substitui a instalação e o teste funcional do APK.
