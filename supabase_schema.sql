-- Habilitar extensão uuid-ossp para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de Estoque
-- A quantidade aqui será a 'quantidade atual', que será manipulada pelas transações.
CREATE TABLE estoque (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    custo NUMERIC(10, 2) NOT NULL, -- Custo unitário atual
    venda NUMERIC(10, 2) NOT NULL, -- Preço de venda unitário atual
    qtd INTEGER NOT NULL DEFAULT 0, -- Quantidade atual em estoque
    alerta_min INTEGER NOT NULL DEFAULT 0 -- Nível mínimo para alerta
);

-- Tabela de Transações
-- Esta tabela será o coração do sistema, registrando todas as movimentações financeiras e de estoque.
CREATE TABLE transacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo TEXT NOT NULL, -- 'venda', 'despesa', 'compra_estoque', 'ajuste_estoque_entrada', 'ajuste_estoque_saida'
    descricao TEXT NOT NULL,
    valor NUMERIC(10, 2) NOT NULL, -- Valor total da transação (positivo para entrada, negativo para saída)
    quantidade INTEGER, -- Quantidade de produto envolvida (para venda e compra_estoque)
    data TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    produto_id UUID REFERENCES estoque(id) ON DELETE SET NULL, -- Opcional, para transações não relacionadas a produtos
    custo_unitario_no_momento NUMERIC(10, 2), -- Custo unitário do produto no momento da transação (para cálculo de lucro histórico)
    venda_unitario_no_momento NUMERIC(10, 2) -- Preço de venda unitário do produto no momento da transação
);

-- Função RPC para Venda Rápida
-- Agora, a venda rápida registra a transação e atualiza o estoque.
CREATE OR REPLACE FUNCTION realizar_venda_rapida(produto_id_param UUID, quantidade_param INTEGER) 
RETURNS VOID AS $$
DECLARE
    produto_info estoque;
    valor_total_venda NUMERIC(10, 2);
BEGIN
    -- Obter informações do produto
    SELECT * INTO produto_info
    FROM estoque
    WHERE id = produto_id_param;

    -- Verificar se o produto existe
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    -- Verificar se há estoque suficiente
    IF produto_info.qtd < quantidade_param THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto % (disponível: %, solicitado: %)', produto_info.nome, produto_info.qtd, quantidade_param;
    END IF;

    -- Calcular valor total da venda
    valor_total_venda := produto_info.venda * quantidade_param;

    -- Inserir a transação de venda
    INSERT INTO transacoes (tipo, descricao, valor, quantidade, data, produto_id, custo_unitario_no_momento, venda_unitario_no_momento)
    VALUES (
        'venda',
        'Venda de ' || quantidade_param || ' unidades de ' || produto_info.nome,
        valor_total_venda, -- Valor total da venda
        quantidade_param,
        NOW(),
        produto_id_param,
        produto_info.custo, -- Custo unitário no momento da venda
        produto_info.venda -- Preço de venda unitário no momento da venda
    );

    -- Subtrair a quantidade do estoque
    UPDATE estoque
    SET qtd = qtd - quantidade_param
    WHERE id = produto_id_param;
END;
$$ LANGUAGE plpgsql;
