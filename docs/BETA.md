# Beta interno — Diário de Leitura

## Estado do APK

Há um primeiro build Android de preview no [EAS](https://expo.dev/accounts/marxs-team/projects/diario-leitura/builds/50c07104-9e6a-41d6-a93a-7543c221fea0). O código recebeu mudanças depois dele; gere e instale um novo APK antes de testar ou compartilhar a versão atual.

Para gerar o APK atualizado, na pasta do projeto:

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Após baixar, instale no Android. Se o sistema pedir, autorize temporariamente a instalação pelo navegador ou gerenciador de arquivos usado.

## Antes de começar

O app não exige conta e mantém livros, notas, perfil, estantes e imagens no aparelho. Exportação de backup é manual e a restauração substitui a biblioteca atual. Faça um backup antes de testar a restauração e avise os testadores que não há sincronização em nuvem.

A pesquisa envia o termo de título/autor à Google Books API e requer internet; o cadastro manual segue disponível offline. A chave `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY` é incluída no app, portanto não é um segredo. Restrinja-a à API, aos identificadores do app e a cotas.

O gráfico oficial “Powered by Google” está em `assets/images/google-books-powered-by.png`; conferir sua apresentação no aparelho e revisar as [diretrizes de marca da Google Books](https://developers.google.com/books/branding) antes de divulgação pública.

## Roteiro de validação Android

Registre modelo do aparelho, versão do Android, passos, resultado esperado e resultado observado. Remova dados pessoais de capturas e não compartilhe texto privado de anotações.

1. Instale o APK, abra o app, feche-o e abra novamente.
2. Cadastre um livro manualmente e confirme que continua na biblioteca após reiniciar o app.
3. Pesquise um livro online, escolha um resultado, confira título, autor, páginas e capa; abra o link de informações.
4. Teste pesquisa sem resultados e sem conexão; confirme que o cadastro manual continua disponível.
5. Edite título, autor, total de páginas, progresso, datas e formato. Confira status, datas e percentual.
6. Avalie um livro com meia estrela (0,5), 3,5 e 4,5 estrelas; confirme que avaliações antigas inteiras continuam iguais, altere a nota, remova a avaliação e confira a exibição na biblioteca.
7. Toque numa capa da faixa horizontal, confira as informações e ações do detalhe e teste a personalização da capa por toque longo.
8. Crie duas estantes e associe o mesmo livro a ambas. Abra cada estante, edite nome/cor/símbolo, escolha uma imagem quadrada própria, troque-a e remova-a.
9. Remova uma estante e confirme que os livros continuam na biblioteca e nas outras estantes.
10. Inicie uma leitura, registre páginas na seção “Em andamento” e confira se ela sai da lista ao concluir o livro.
11. Crie, edite e exclua anotações com e sem número de página.
12. Confira as estatísticas anuais e o mapa de páginas lidas por dia, inclusive depois de registrar leitura.
13. Mude nome, forma de tratamento, meta, tema e avatar; feche/reabra e confirme a persistência.
14. Escolha uma capa de livro, restaure a capa anterior e teste cancelar/recusar a seleção de imagem.
15. Exporte um backup. Em uma instalação ou biblioteca de teste, restaure-o e confira livros, estantes, avaliações, notas, perfil e imagens. A restauração substitui os dados existentes; preserve o backup original.
16. Confira o gráfico “Powered by Google”, alinhamento dos ícones, legibilidade em tela pequena e mensagens de erro.

## Depois do teste

Corrija bloqueadores antes de convidar mais pessoas. Comece com um grupo pequeno e explique que os dados permanecem no aparelho e precisam ser exportados manualmente para recuperação.

O projeto não tem suíte automatizada de testes. As verificações `npx tsc --noEmit` e `npx expo lint` cobrem tipos e lint, mas não substituem o roteiro em aparelho.

## iOS e lojas

Para testar em iPhone, configurar credenciais Apple e um build compatível; TestFlight requer conta Apple Developer. Publicação em lojas ainda exige revisar privacidade, licença, metadados, classificação etária, requisitos vigentes e regras da Google Books.
