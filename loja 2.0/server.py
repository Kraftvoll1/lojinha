from flask import Flask, jsonify, request, send_from_directory
import os
import uuid
import datetime

app = Flask(__name__, static_folder='public/static', template_folder='public')

orders_db = []

@app.route('/')
def home():
    """Serve o arquivo HTML principal."""
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve arquivos estáticos da pasta public."""
    return send_from_directory(app.template_folder, filename)

@app.route('/api/products')
def get_products():
    """Endpoint da API para obter a lista de produtos."""
    try:
        with open('public/static/products.json', 'r', encoding='utf-8') as f:
            data = f.read()
        return data, 200, {'Content-Type': 'application/json'}
    except FileNotFoundError:
        return jsonify({"ok": False, "message": "Arquivo de produtos não encontrado."}), 404
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500

@app.route('/api/orders', methods=['POST'])
def place_order():
    """Endpoint da API para finalizar um pedido."""
    payload = request.get_json()
    if not payload:
        return jsonify({"ok": False, "message": "Nenhum dado recebido."}), 400

    try:
        customer = payload.get('customer')
        items = payload.get('items')

        if not customer or not items:
            return jsonify({"ok": False, "message": "Dados do pedido incompletos."}), 400

        print(f"Processando novo pedido de {customer.get('name')}...")

        products_data = {}
        with open('public/static/products.json', 'r', encoding='utf-8') as f:
            products_list = jsonify(f.read())
            products_data = {p['id']: p for p in products_list.get_json().get('products', [])}

        subtotal = sum(products_data.get(item['id'], {}).get('price', 0) * item['qty'] for item in items)
        shipping = 0 if subtotal >= 199 else (19.9 if subtotal > 0 else 0)
        total = subtotal + shipping

        order = {
            "order_id": str(uuid.uuid4()),
            "customer": customer,
            "items": items,
            "subtotal": subtotal,
            "shipping": shipping,
            "total": total,
            "date": datetime.datetime.now().isoformat(),
            "status": "processing"
        }
        
        orders_db.append(order)
        print(f"Pedido #{order['order_id']} registrado com sucesso.")
        
        return jsonify({
            "ok": True, 
            "message": "Pedido criado com sucesso.", 
            "order_id": order["order_id"],
            "totals": {"subtotal": subtotal, "shipping": shipping, "total": total}
        }), 201

    except Exception as e:
        print(f"Erro ao processar pedido: {e}")
        return jsonify({"ok": False, "message": "Erro interno do servidor."}), 500

if __name__ == '__main__':
    if not os.path.exists('public/static'):
        os.makedirs('public/static')
    app.run(debug=True, port=5000)