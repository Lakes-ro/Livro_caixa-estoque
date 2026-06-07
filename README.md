# DarkTech Manager - Livro Caixa + Estoque

Aplicativo integrado de controle de estoque e livro caixa com estética DarkTech.

## Tecnologias
- HTML5 / Tailwind CSS
- JavaScript Moderno
- Supabase (Backend as a Service)
- jsPDF & SheetJS (Relatórios)

## Configuração do Banco de Dados (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Vá em **SQL Editor** e execute o conteúdo do arquivo `supabase_schema.sql`.
3. Em **Project Settings > API**, copie a `URL` e a `anon key`.
4. No arquivo `app.js`, substitua as constantes `SUPABASE_URL` e `SUPABASE_KEY` pelos seus dados.

## Funcionalidades
- **Dashboard**: Visão geral de saldo, lucro e alertas de estoque.
- **PDV**: Venda rápida com 1 clique que atualiza estoque e caixa simultaneamente.
- **Estoque**: Cadastro e gerenciamento de produtos com alerta de nível mínimo.
- **Livro Caixa**: Registro automático de vendas e manual de despesas.
- **Relatórios**: Exportação para PDF e Excel.

## Deploy
Este projeto pode ser hospedado gratuitamente no **GitHub Pages** ou **Vercel**. Basta fazer o upload dos arquivos `index.html`, `app.js` e `supabase_schema.sql`.
