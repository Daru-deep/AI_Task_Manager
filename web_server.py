from flask import Flask, jsonify, send_from_directory, request
import app


# web/ フォルダを静的ファイル置き場にする
server = Flask(__name__, static_folder="web")

@server.get("/api/today")
def api_today():
    """今日のおすすめタスク一覧を返す"""
    try:
        recs = app.get_today_recommendation()
        # ★ ここでそのまま配列を返す
        return jsonify(recs)
    except Exception as e:
        print(f"[エラー] 今日のおすすめ取得に失敗: {e}")
        # エラー時は空配列を返す（フロント側で「タスクなし」として扱える）
        return jsonify([]), 500

@server.post("/api/import_state")
def api_import_state():
    """
    日誌JSONを受け取り、state更新＋new_tasks追加を行う。
    成功したら更新後の今日のおすすめを返す。
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"success": False, "error": "invalid json"}), 400

    try:
        app.import_state_data(data)
    except Exception as e:
        print(f"[エラー] 日誌インポートに失敗: {e}")
        return jsonify({"success": False, "error": "import failed"}), 500

    recs = app.get_today_recommendation()
    return jsonify({"success": True, "data": recs})


@server.post("/api/tasks/done")
def api_task_done():
    """
    タスク完了API:
    body: { "id": 7 } のようなJSONを受け取り、
    対応するタスクの status を 'done' に更新する。
    """
    data = request.get_json(silent=True) or {}
    task_id_raw = data.get("id")

    try:
        task_id = int(task_id_raw)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "error": "invalid id"
        }), 400

    ok = app.complete_task(task_id)
    if not ok:
        return jsonify({
            "success": False,
            "error": "task not found"
        }), 404

    # 更新後の今日のおすすめも返しておく（フロントで使ってもいいし無視してもいい）
    recs = app.get_today_recommendation()
    return jsonify({
        "success": True,
        "data": recs
    })

"""web/を返す"""
@server.get("/")
def index():
    return send_from_directory(server.static_folder, "index.html")
@server.get("/style.css")
def style_css():
    return send_from_directory("web", "style.css")
@server.get("/main.js")
def main_js():
    return send_from_directory("web", "main.js")

if __name__ == "__main__":
    # ===== 接続設定 =====
    # 自分のPCからのみ: host="127.0.0.1"
    # 同じWiFi内のスマホから: host="0.0.0.0" (注意: デバッグモードは必ず無効化)
    HOST = "127.0.0.1"
    PORT = 5000
    DEBUG = True
    
    server.run(debug=DEBUG, host=HOST, port=PORT)