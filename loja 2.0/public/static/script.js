const API = {
    products: '/api/products',
    orders: '/api/orders',
};

let PRODUCTS = [];
let CART = []; 

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const productGrid = $('#product-grid');
const cartCount = $('#cart-count');
const cartModal = $('#cart-modal');
const cartItemsList = $('#cart-items');
const checkoutForm = $('#checkout-form');
const checkoutStatus = $('#checkout-status');
const placeOrderBtn = $('#place-order');

function currency(v){
    return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
}

function saveCart(){
    localStorage.setItem('cart', JSON.stringify(CART));
    updateCartCount();
}
function loadCart(){
    CART = JSON.parse(localStorage.getItem('cart') || '[]');
    updateCartCount();
}
function updateCartCount(){
    const count = CART.reduce((s,i)=>s+i.qty,0);
    cartCount.textContent = count;
}

async function fetchProducts(){
    try {
        const q = $('#search-input').value.trim();
        const category = $('#category-filter').value;
        const res = await fetch(API.products + buildQuery({ q, category }));
        if (!res.ok) throw new Error('Falha ao buscar produtos');
        const data = await res.json();
        PRODUCTS = data.products;
        renderCategoryOptions(PRODUCTS);
        renderProducts(PRODUCTS);
    } catch (err) {
        console.error('Erro em fetchProducts:', err);
        productGrid.innerHTML = `<p class="error-message">Erro ao carregar produtos. Tente novamente mais tarde.</p>`;
    }
}

function buildQuery(params){
    const qs = Object.entries(params)
        .filter(([,v]) => v !== '' && v !== null && v !== undefined)
        .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    return qs ? `?${qs}` : '';
}

function renderCategoryOptions(products){
    const select = $('#category-filter');
    const current = select.value;
    const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
    select.innerHTML = `<option value="">Todas as categorias</option>` + categories.map(c => `<option value="${c}">${c}</option>`).join('');
    if (categories.includes(current)) select.value = current;
}

function renderProducts(products){
    const sort = $('#sort-select').value;
    const items = [...products];
    if (sort === 'price-asc') items.sort((a,b)=>a.price-b.price);
    if (sort === 'price-desc') items.sort((a,b)=>b.price-a.price);
    if (sort === 'title-asc') items.sort((a,b)=>a.title.localeCompare(b.title));
    if (sort === 'title-desc') items.sort((a,b)=>b.title.localeCompare(a.title));

    productGrid.innerHTML = items.map(p => productCardHTML(p)).join('');
}

function productCardHTML(p){
    const compare = p.compare_at_price && p.compare_at_price > p.price ? `<span class="compare">${currency(p.compare_at_price)}</span>` : '';
    const disabled = p.stock <= 0 ? 'disabled' : '';
    return `
        <article class="card">
            <img src="${p.image_url}" alt="${p.title}" loading="lazy">
            <div class="card-body">
                <div class="card-title">${p.title}</div>
                <div class="price">
                    <span class="current">${currency(p.price)}</span>
                    ${compare}
                </div>
                <div class="stock">${p.stock > 0 ? `Em estoque: ${p.stock}` : 'Esgotado'}</div>
                <div class="card-actions">
                    <div class="qty">
                        <label for="qty-${p.id}">Qtd</label>
                        <input id="qty-${p.id}" type="number" min="1" max="${p.stock}" value="1" ${disabled} />
                    </div>
                    <button class="btn btn-success btn-add" data-id="${p.id}" ${disabled}>Adicionar</button>
                </div>
            </div>
        </article>
    `;
}

function onAddToCart(e){
    const btn = e.target.closest('.btn-add');
    if (!btn) return;
    const id = btn.dataset.id;
    const product = PRODUCTS.find(p => p.id === id);
    if (!product || product.stock <= 0) return;

    const qtyInput = document.getElementById(`qty-${id}`);
    const qty = Math.max(1, Math.min(product.stock, parseInt(qtyInput.value || '1', 10)));

    const existing = CART.find(i => i.id === id);
    if (existing){
        existing.qty = Math.min(existing.qty + qty, product.stock);
    } else {
        CART.push({
            id: product.id,
            title: product.title,
            price: product.price,
            image_url: product.image_url,
            stock: product.stock,
            qty
        });
    }
    saveCart();
    renderCart();
    openCart();
}

function renderCart(){
    if (CART.length === 0){
        cartItemsList.innerHTML = `<p>Seu carrinho está vazio.</p>`;
        updateSummary();
        return;
    }
    cartItemsList.innerHTML = CART.map(item => `
        <div class="cart-item">
            <img src="${item.image_url}" alt="${item.title}">
            <div class="meta">
                <div class="title">${item.title}</div>
                <div class="unit">${currency(item.price)} un.</div>
            </div>
            <div class="controls">
                <input type="number" min="1" max="${item.stock}" value="${item.qty}" data-id="${item.id}" class="qty-input">
                <button class="btn btn-danger btn-remove" data-id="${item.id}">Remover</button>
            </div>
        </div>
    `).join('');
    updateSummary();
}

function onCartItemsChange(e) {
    if (e.target.classList.contains('qty-input')) {
        onChangeQty(e);
    } else if (e.target.classList.contains('btn-remove')) {
        onRemoveItem(e);
    }
}

function onChangeQty(e){
    const id = e.target.dataset.id;
    const item = CART.find(i => i.id === id);
    if (!item) return;
    const max = item.stock;
    const newQty = Math.max(1, Math.min(max, parseInt(e.target.value || '1', 10)));
    item.qty = newQty;
    e.target.value = newQty;
    saveCart();
    updateSummary();
}

function onRemoveItem(e){
    const id = e.target.dataset.id;
    CART = CART.filter(i => i.id !== id);
    saveCart();
    renderCart();
}

function calcSubtotal(){
    return CART.reduce((s,i)=> s + i.price * i.qty, 0);
}
function calcShipping(subtotal){
    return subtotal >= 199 ? 0 : (subtotal > 0 ? 19.9 : 0);
}
function updateSummary(){
    const subtotal = calcSubtotal();
    const shipping = calcShipping(subtotal);
    const total = subtotal + shipping;
    $('#subtotal').textContent = currency(subtotal);
    $('#shipping').textContent = currency(shipping);
    $('#total').textContent = currency(total);
}

function openCart(){ cartModal.classList.remove('hidden'); }
function closeCart(){ cartModal.classList.add('hidden'); }

async function placeOrder(e){
    e.preventDefault();
    if (CART.length === 0){
        checkoutStatus.textContent = 'Adicione itens ao carrinho antes de finalizar.';
        return;
    }
    if (!$('#terms').checked){
        checkoutStatus.textContent = 'Você precisa aceitar os termos.';
        return;
    }

    const customer = {
        name: $('#name').value.trim(),
        email: $('#email').value.trim(),
        phone: $('#phone').value.trim(),
        address: $('#address').value.trim(),
        city: $('#city').value.trim(),
        state: $('#state').value.trim(),
        zip: $('#zip').value.trim(),
        notes: $('#notes').value.trim(),
    };
    if (Object.values(customer).some(val => !val && ['name', 'email', 'address', 'city', 'state', 'zip'].includes(Object.keys(customer).find(k => customer[k] === val)))) {
        checkoutStatus.textContent = 'Preencha os campos obrigatórios.';
        return;
    }

    placeOrderBtn.disabled = true;
    checkoutStatus.textContent = 'Processando pedido...';

    try {
        const res = await fetch(API.orders, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ customer, items: CART.map(i => ({ id:i.id, qty:i.qty })) })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || 'Erro ao criar pedido.');

        checkoutStatus.textContent = `Pedido realizado! Número: ${data.order_id}. Total: ${currency(data.totals.total)}.`;
        CART = [];
        saveCart();
        renderCart();
        fetchProducts();
    } catch (err){
        checkoutStatus.textContent = `Falha ao finalizar: ${err.message}`;
    } finally {
        placeOrderBtn.disabled = false;
    }
}

function initUI(){
    $('#year').textContent = new Date().getFullYear();
    $('#open-cart').addEventListener('click', openCart);
    $('#close-cart').addEventListener('click', closeCart);
    $('#search-input').addEventListener('input', debounce(fetchProducts, 250));
    $('#category-filter').addEventListener('change', fetchProducts);
    $('#sort-select').addEventListener('change', () => renderProducts(PRODUCTS));
    productGrid.addEventListener('click', onAddToCart);
    cartItemsList.addEventListener('click', onCartItemsChange);
    checkoutForm.addEventListener('submit', placeOrder);
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeCart(); });
}

function debounce(fn, wait){
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

loadCart();
initUI();
fetchProducts();
renderCart();