from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from models import User, Order
from payment import snap
import time
from email_service import send_product_email
import os

app = Flask(__name__)

CORS(app)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///jaydreamstore.db"

db.init_app(app)

with app.app_context():
    db.create_all()

@app.route("/")
def home():
    return "JayDreamStore Backend Running"

@app.route("/register", methods=["POST"])
def register():

    data = request.get_json()

    username = data["username"]
    email = data["email"]
    password = data["password"]

    if User.query.filter_by(email=email).first():
        return jsonify({
            "success": False,
            "message": "Email sudah digunakan."
        }), 400

    user = User(
        username=username,
        email=email,
        password=generate_password_hash(password)
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Register berhasil."
    })


@app.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    email = data["email"]
    password = data["password"]

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({
            "success": False,
            "message": "Email tidak ditemukan."
        }), 404

    if not check_password_hash(user.password, password):
        return jsonify({
            "success": False,
            "message": "Password salah."
        }), 401

    return jsonify({
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        }
    })

@app.route("/midtrans-webhook", methods=["POST"])
def midtrans_webhook():

    try:

        data = request.get_json()

        order_id = data.get("order_id")
        transaction_status = data.get("transaction_status")
        fraud_status = data.get("fraud_status")

        print("MIDTRANS NOTIFICATION:")
        print(data)

        order = Order.query.filter_by(
            order_id=order_id
        ).first()

        if not order:
            return jsonify({
                "success": False,
                "message": "Order tidak ditemukan."
            }), 404

        paid = False

        if transaction_status == "settlement":

            paid = True

        elif transaction_status == "capture" and fraud_status == "accept":

            paid = True

        elif transaction_status == "pending":

            order.payment_status = "pending"

        elif transaction_status in [
            "deny",
            "cancel",
            "expire"
        ]:

            order.payment_status = "failed"

        if paid:

            order.payment_status = "paid"

            if order.email_status != "sent":

                download_link = (
                    "http://127.0.0.1:5000/download/"
                    + order.order_id
                )

                try:

                    send_product_email(
                        order.email,
                        order.product_name,
                        download_link
                    )

                    order.email_status = "sent"

                    print(
                        "EMAIL BERHASIL DIKIRIM:",
                        order.email
                    )

                except Exception as e:

                    print("EMAIL ERROR:", e)

                    order.email_status = "failed"

        db.session.commit()

        return jsonify({
            "success": True
        })

    except Exception as e:

        print("WEBHOOK ERROR:", e)

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@app.route("/create-payment", methods=["POST"])
def create_payment():

    try:

        data = request.get_json()

        order_id = "ORDER-" + str(int(time.time() * 1000))

        order = Order(
            order_id=order_id,
            user_id=data.get("user_id"),
            product_id=data["product_id"],
            product_name=data["product_name"],
            email=data["email"],
            price=data["price"],
            payment_status="pending",
            email_status="pending"
        )

        db.session.add(order)
        db.session.commit()

        transaction = {

            "transaction_details": {
                "order_id": order_id,
                "gross_amount": data["price"]
            },

            "item_details": [
                {
                    "id": str(data["product_id"]),
                    "price": data["price"],
                    "quantity": 1,
                    "name": data["product_name"]
                }
            ],

            "customer_details": {
                "email": data["email"]
            }

        }

        token = snap.create_transaction(transaction)

        return jsonify({
            "success": True,
            "order_id": order_id,
            "token": token["token"]
        })

    except Exception as e:

        print("ERROR CREATE PAYMENT:", e)

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@app.route("/download/<order_id>", methods=["GET"])
def download_product(order_id):

    order = Order.query.filter_by(
        order_id=order_id
    ).first()

    if not order:
        return jsonify({
            "success": False,
            "message": "Order tidak ditemukan."
        }), 404

    if order.payment_status != "paid":
        return jsonify({
            "success": False,
            "message": "Pembayaran belum berhasil."
        }), 403

    product_files = {

        1: "gotoubunkpreset.zip",

        2: "capcutpro.zip",

        3: "alightmotion.zip"

    }

    filename = product_files.get(order.product_id)

    if not filename:
        return jsonify({
            "success": False,
            "message": "File produk tidak ditemukan."
        }), 404

    file_path = os.path.join(
        os.path.dirname(__file__),
        "products",
        filename
    )

    if not os.path.exists(file_path):
        return jsonify({
            "success": False,
            "message": "File produk belum tersedia."
        }), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename
    )

if __name__ == "__main__":
    app.run(debug=True)