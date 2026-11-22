# Diário de Leitura

Aplicativo móvel para organizar livros, acompanhar leituras, escrever anotações e visualizar estatísticas pessoais. O app é local-first: a biblioteca fica no aparelho, sem conta ou sincronização em nuvem.

## Funcionalidades

- Cadastro manual ou busca de livros na Google Books API.
- Progresso por página, datas de início e conclusão, formato físico/Kindle e avaliação opcional de 1 a 5 estrelas.
- Notas editáveis por livro.
- Estantes personalizadas: vários livros por estante, com nome, cor, símbolo ou imagem própria.
- Biblioteca horizontal por capas e seção “Em andamento”.
- Estatísticas anuais, incluindo mapa de páginas lidas por dia.
- Perfil com avatar, meta anual e quatro temas.
- Exportação e restauração manual da biblioteca por arquivo, incluindo imagens.

## Tecnologias

Expo SDK 58, React Native 0.88, React 19, TypeScript 6, Expo Router e Expo SQLite. A busca online usa a Google Books API; o cadastro manual funciona sem conexão.

Para instalar dependências e iniciar o projeto:

```bash
npm install
npx expo start
```

Para gerar o APK interno Android, consulte [docs/BETA.md](./docs/BETA.md).

## Armazenamento e privacidade

Livros, progresso, notas, estantes, perfil e imagens são mantidos localmente. Não há conta nem sincronização. A exportação de backup é manual; restaurar um arquivo substitui os dados locais atuais. Guarde uma cópia do backup antes de restaurar. A busca de livros precisa de internet e envia o termo pesquisado à Google Books API.

Antes de compartilhar o app, informe aos usuários que a perda do aparelho ou a desinstalação pode causar perda dos dados sem um backup recente.

## Documentação

- [Estado atual e pendências](./docs/ESTADO-ATUAL.md)
- [Roteiro do beta Android](./docs/BETA.md)

## Licença

A licença do projeto ainda precisa ser confirmada. O arquivo `LICENSE` presente no repositório contém texto padrão atribuído à Expo; não trate isso como a licença escolhida para o Diário de Leitura até que ela seja revisada.
