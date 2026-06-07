// Configuração do Supabase
const SUPABASE_URL = 'SUA_SUPABASE_URL';
const SUPABASE_KEY = 'SUA_SUPABASE_ANON_KEY';

let supabaseClient = null;

// Inicializar cliente apenas se as credenciais forem válidas
if (SUPABASE_URL.startsWith('http') && SUPABASE_KEY !== 'SUA_SUPABASE_ANON_KEY') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Estado Global
let produtos = [];
let transacoes = [];
let deferredPrompt;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (supabaseClient) {
        loadData();
    } else {
        console.warn('Supabase não configurado. Insira as credenciais no app.js');
        alert('Atenção: Configure as credenciais do Supabase no arquivo app.js para o sistema funcionar.');
    }
    setupEventListeners();
    registerServiceWorker();
    setupPWAInstall();
    showSection('dashboard');
});

// PWA & Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registrado!'))
            .catch(err => console.error('Erro no SW:', err));
    }
}

function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        document.getElementById('install-popup').classList.remove('hidden');
    });

    const installBtn = document.getElementById('install-button');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('Usuário aceitou a instalação');
                }
                deferredPrompt = null;
                closeInstallPopup();
            }
        });
    }
}

function closeInstallPopup() {
    const popup = document.getElementById('install-popup');
    if (popup) popup.classList.add('hidden');
}

// Lógica de Dados
async function loadData() {
    if (!supabaseClient) return;
    await Promise.all([fetchEstoque(), fetchTransacoes()]);
    updateDashboard();
    renderEstoque();
    renderPDV();
    renderTransacoes();
}

async function fetchEstoque() {
    const { data, error } = await supabaseClient.from('estoque').select('*').order('nome');
    if (error) console.error('Erro ao buscar estoque:', error);
    else produtos = data || [];
}

async function fetchTransacoes() {
    const { data, error } = await supabaseClient.from('transacoes').select('*').order('data', { ascending: false });
    if (error) console.error('Erro ao buscar transações:', error);
    else transacoes = data || [];
}

function updateDashboard() {
    const saldo = transacoes.reduce((acc, t) => {
        if (t.tipo === 'venda') return acc + parseFloat(t.valor);
        if (t.tipo === 'despesa' || t.tipo === 'compra_estoque') return acc - parseFloat(t.valor);
        return acc;
    }, 0);
    
    const lucro = transacoes.reduce((acc, t) => {
        if (t.tipo === 'venda' && t.venda_unitario_no_momento && t.custo_unitario_no_momento && t.quantidade) {
            return acc + ((parseFloat(t.venda_unitario_no_momento) - parseFloat(t.custo_unitario_no_momento)) * parseInt(t.quantidade));
        }
        return acc;
    }, 0);

    document.getElementById('saldo-total').innerText = `R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('lucro-mes').innerText = `R$ ${lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const alertas = produtos.filter(p => p.qtd <= p.alerta_min);
    const alertaList = document.getElementById('alertas-estoque');
    if (alertaList) {
        alertaList.innerHTML = alertas.length > 0 
            ? alertas.map(p => `<li>⚠️ ${p.nome} (${p.qtd} un)</li>`).join('')
            : '<li class="text-gray-500">Tudo em dia!</li>';
    }
}

function renderEstoque() {
    const tbody = document.getElementById('tabela-estoque');
    if (!tbody) return;
    tbody.innerHTML = produtos.map(p => `
        <tr class="border-b border-[#30363d] hover:bg-[#1c2128]">
            <td class="p-4 font-medium">${p.nome}</td>
            <td class="p-4">R$ ${parseFloat(p.custo).toFixed(2)}</td>
            <td class="p-4">R$ ${parseFloat(p.venda).toFixed(2)}</td>
            <td class="p-4 ${p.qtd <= p.alerta_min ? 'text-red-400 font-bold' : ''}">${p.qtd}</td>
            <td class="p-4 text-right">
                <button onclick="openModal('modal-entrada-estoque', '${p.id}')" class="text-[#58a6ff] hover:text-[#1f6feb] mr-2">
                    <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                </button>
                <button onclick="deleteProduto('${p.id}')" class="text-red-500 hover:text-red-400">
                    <svg class="w-5 h-5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderPDV() {
    const grid = document.getElementById('pdv-grid');
    if (!grid) return;
    grid.innerHTML = produtos.map(p => `
        <button onclick="vendaRapida('${p.id}')" class="card p-4 rounded-xl text-center hover:border-[#58a6ff] active:scale-95 transition-all">
            <div class="font-bold truncate text-sm">${p.nome}</div>
            <div class="text-[#58a6ff] font-bold text-lg">R$ ${parseFloat(p.venda).toFixed(2)}</div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider">${p.qtd} em estoque</div>
        </button>
    `).join('');
}

function renderTransacoes() {
    const tbody = document.getElementById('tabela-transacoes');
    if (!tbody) return;
    tbody.innerHTML = transacoes.map(t => {
        let valorDisplay = `R$ ${parseFloat(t.valor).toFixed(2)}`;
        let tipoClass = '';
        let tipoText = t.tipo;

        if (t.tipo === 'venda') {
            tipoClass = 'bg-green-900/30 text-green-400';
            valorDisplay = `+ ${valorDisplay}`;
        } else if (t.tipo === 'despesa') {
            tipoClass = 'bg-red-900/30 text-red-400';
            valorDisplay = `- ${valorDisplay}`;
        } else if (t.tipo === 'compra_estoque') {
            tipoClass = 'bg-blue-900/30 text-blue-400';
            valorDisplay = `- ${valorDisplay}`;
            tipoText = 'Compra Estoque';
        }

        return `
            <tr class="border-b border-[#30363d] hover:bg-[#1c2128]">
                <td class="p-4 text-xs text-gray-400">${new Date(t.data).toLocaleDateString('pt-BR')}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${tipoClass}">
                        ${tipoText}
                    </span>
                </td>
                <td class="p-4 text-sm">${t.descricao}</td>
                <td class="p-4 font-bold ${tipoClass}">
                    ${valorDisplay}
                </td>
            </tr>
        `;
    }).join('');
}

// Ações
async function vendaRapida(produtoId) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.rpc('realizar_venda_rapida', {
        produto_id_param: produtoId,
        quantidade_param: 1
    });

    if (error) alert('Erro na venda: ' + error.message);
    else loadData();
}

async function deleteProduto(id) {
    if (!supabaseClient) return;
    if (confirm('Deseja excluir este produto? Isso também removerá transações associadas.')) {
        const { error } = await supabaseClient.from('estoque').delete().eq('id', id);
        if (error) alert('Erro ao excluir produto: ' + error.message);
        else loadData();
    }
}

async function addEstoque(produtoId, quantidade, custoUnitario) {
    if (!supabaseClient) return;
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return alert('Produto não encontrado.');

    const valorTotalCompra = quantidade * custoUnitario;

    const { error: transError } = await supabaseClient.from('transacoes').insert({
        tipo: 'compra_estoque',
        descricao: `Compra de ${quantidade} unidades de ${produto.nome}`,
        valor: valorTotalCompra,
        quantidade: quantidade,
        produto_id: produtoId,
        custo_unitario_no_momento: custoUnitario,
        venda_unitario_no_momento: produto.venda
    });

    if (transError) {
        alert('Erro ao registrar compra de estoque: ' + transError.message);
        return;
    }

    const { error: estoqueError } = await supabaseClient.from('estoque')
        .update({ qtd: parseInt(produto.qtd) + parseInt(quantidade), custo: custoUnitario })
        .eq('id', produtoId);

    if (estoqueError) {
        alert('Erro ao atualizar estoque: ' + estoqueError.message);
        return;
    }

    loadData();
}

// Event Listeners
function setupEventListeners() {
    const formProd = document.getElementById('form-produto');
    if (formProd) {
        formProd.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;
            const novoProd = {
                nome: document.getElementById('prod-nome').value,
                custo: parseFloat(document.getElementById('prod-custo').value),
                venda: parseFloat(document.getElementById('prod-venda').value),
                qtd: parseInt(document.getElementById('prod-qtd').value),
                alerta_min: parseInt(document.getElementById('prod-alerta').value)
            };

            const { error } = await supabaseClient.from('estoque').insert([novoProd]);
            if (error) alert('Erro ao salvar produto: ' + error.message);
            else {
                closeModal('modal-produto');
                e.target.reset();
                loadData();
            }
        });
    }

    const formTrans = document.getElementById('form-transacao');
    if (formTrans) {
        formTrans.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;
            const novaTrans = {
                tipo: 'despesa',
                descricao: document.getElementById('trans-desc').value,
                valor: parseFloat(document.getElementById('trans-valor').value)
            };

            const { error } = await supabaseClient.from('transacoes').insert([novaTrans]);
            if (error) alert('Erro ao registrar despesa: ' + error.message);
            else {
                closeModal('modal-transacao');
                e.target.reset();
                loadData();
            }
        });
    }

    const formEntrada = document.getElementById('form-entrada-estoque');
    if (formEntrada) {
        formEntrada.addEventListener('submit', async (e) => {
            e.preventDefault();
            const produtoId = e.target.dataset.productId;
            const quantidade = parseInt(document.getElementById('entrada-qtd').value);
            const custoUnitario = parseFloat(document.getElementById('entrada-custo').value);
            
            if (produtoId && quantidade > 0 && custoUnitario >= 0) {
                await addEstoque(produtoId, quantidade, custoUnitario);
                closeModal('modal-entrada-estoque');
                e.target.reset();
            } else {
                alert('Por favor, preencha todos os campos corretamente.');
            }
        });
    }
}

// UI Helpers
function showSection(id) {
    ['dashboard', 'pdv', 'estoque', 'transacoes'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    
    const navMap = {
        'dashboard': 'btn-dash',
        'pdv': 'btn-pdv',
        'estoque': 'btn-est',
        'transacoes': 'btn-trans'
    };
    
    Object.values(navMap).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(navMap[id]);
    if (activeBtn) activeBtn.classList.add('active');

    const mobileBtns = document.querySelectorAll('.nav-mobile button');
    mobileBtns.forEach(btn => {
        btn.classList.remove('text-[#58a6ff]');
        btn.classList.add('text-[#8b949e]');
    });
    
    const sectionIndex = ['dashboard', 'transacoes', 'pdv', 'estoque'].indexOf(id);
    if (sectionIndex !== -1 && mobileBtns[sectionIndex]) {
        mobileBtns[sectionIndex].classList.add('text-[#58a6ff]');
        mobileBtns[sectionIndex].classList.remove('text-[#8b949e]');
    }

    window.scrollTo(0, 0);
}

function openModal(id, productId = null) { 
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (productId && id === 'modal-entrada-estoque') {
            document.getElementById('form-entrada-estoque').dataset.productId = productId;
        }
    }
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

// Relatórios
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Relatório de Movimentações - DarkTech", 14, 20);
    
    const data = transacoes.map(t => {
        let valorDisplay = `R$ ${parseFloat(t.valor).toFixed(2)}`;
        if (t.tipo === 'venda') valorDisplay = `+ ${valorDisplay}`;
        else if (t.tipo === 'despesa' || t.tipo === 'compra_estoque') valorDisplay = `- ${valorDisplay}`;

        let tipoText = t.tipo;
        if (t.tipo === 'compra_estoque') tipoText = 'Compra Estoque';

        return [
            new Date(t.data).toLocaleDateString('pt-BR'),
            tipoText.toUpperCase(),
            t.descricao,
            valorDisplay
        ];
    });

    doc.autoTable({
        head: [['Data', 'Tipo', 'Descrição', 'Valor']],
        body: data,
        startY: 30,
        theme: 'grid',
        headStyles: { fillColor: [88, 166, 255] }
    });

    doc.save('relatorio_mensal.pdf');
}

function exportExcel() {
    const ws_estoque = XLSX.utils.json_to_sheet(produtos);
    const ws_caixa = XLSX.utils.json_to_sheet(transacoes);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws_estoque, "Estoque");
    XLSX.utils.book_append_sheet(wb, ws_caixa, "Caixa");
    XLSX.writeFile(wb, "relatorio_caixa_estoque.xlsx");
}
