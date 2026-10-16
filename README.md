# Diário de Leitura

Aplicativo móvel para organizar leituras, acompanhar o progresso dos livros,
registrar notas e personalizar o perfil de leitura.

## Visão geral

O projeto foi criado com Expo, React Native, TypeScript e Expo Router. A
primeira versão prioriza uma experiência simples e local:

- estante pessoal de livros;
- acompanhamento de páginas lidas;
- notas associadas a cada livro;
- busca opcional de livros pela Google Books API;
- capas e avatar escolhidos pelo usuário;
- temas visuais e meta anual de leitura.

Os dados ficam armazenados localmente no dispositivo. A versão atual não
possui conta, backup ou sincronização entre dispositivos.

## Tecnologias

- Expo e React Native;
- TypeScript;
- Expo Router;
- Expo SQLite;
- Google Books API, para pesquisa opcional.

## Status

O MVP está em fase de testes internos. O foco atual é validar a experiência
em aparelhos reais, corrigir problemas encontrados no uso cotidiano e
refinar a publicação futura.

## Privacidade

Livros, notas, perfil e imagens são armazenados no espaço local do aplicativo.
Não inclua informações sensíveis em ambientes de teste. A ausência de backup
significa que a desinstalação do aplicativo ou a perda do dispositivo pode
causar perda dos dados.

## Licença

Os termos de licenciamento serão definidos antes da publicação do código.
