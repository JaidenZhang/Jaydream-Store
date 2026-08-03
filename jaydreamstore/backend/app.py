from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

from database import db
from models import User

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


if __name__ == "__main__":
    app.run(debug=True)