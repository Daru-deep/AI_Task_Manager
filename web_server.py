from flask import Flask, jsonify, send_from_directory, request
from pathlib import Path
import json
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

@server.get("/api/state")
def api_state_get():
    try:
        # state.jsonを直接読み込む
        from pathlib import Path
        import json
        
        state_path = Path("data/state.json")
        if not state_path.exists():
            return jsonify({"success": False, "error": "state.jsonが見つかりません"}), 404
        
        with open(state_path, "r", encoding="utf-8") as f:
            state_data = json.load(f)
        
        return jsonify({"success": True, "data": state_data})
    except Exception as e:
        print(f"[エラー] state取得失敗: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@server.post("/api/import_state")
def api_import_state():
    """
    日誌JSON(state_xxx.json相当)をブラウザから受け取り、
    import/state_YYYY-MM-DD.json に保存してから
    app.import_state_log() で取り込む。
    """

    # 1. JSONボディを受け取る
    data = request.get_json(silent=True)
    print("[api_import_state] 受信:", type(data), data)  # デバッグ用

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "error": "JSON body が不正です。"
        }), 400

    # 2. 日付を決定（JSON内の date があればそれを使う）
    date_str = data.get("date")
    if not isinstance(date_str, str) or not date_str:
        from datetime import date
        date_str = date.today().isoformat()

    # 3. import/ フォルダに state_YYYY-MM-DD.json として保存
    import_dir = Path("import")
    import_dir.mkdir(exist_ok=True)

    dst = import_dir / f"state_{date_str}.json"
    try:
        dst.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )
        print(f"[api_import_state] 保存完了: {dst}")
    except Exception as e:
        print(f"[エラー] 日誌ファイルの保存に失敗: {e}")
        return jsonify({
            "success": False,
            "error": "日誌ファイルの保存に失敗しました。"
        }), 500

    # 4. 既存ロジック(app.import_state_log)を呼び出し
    try:
        print(f"[api_import_state] import_state_log 呼び出し: {dst}")
        app.import_state_log(str(dst))
    except Exception as e:
        print(f"[エラー] import_state_log 実行中に例外: {e}")
        return jsonify({
            "success": False,
            "error": "日誌インポート処理中にエラーが発生しました。"
        }), 500

    # 5. 取り込み後の「今日のおすすめ」も返しておく
    try:
        recs = app.get_today_recommendation()
    except Exception as e:
        print(f"[警告] get_today_recommendation で例外: {e}")
        recs = []

    return jsonify({
        "success": True,
        "data": recs
    })

@server.post("/api/import_state_pasted")
def api_import_state_pasted():
    """
    GPT からコピペした JSON テキストを受け取って、
    app.import_state_data() で state を更新するAPI。
    body: { "raw": "<ここに JSON テキスト>" }
    """
    body = request.get_json(silent=True) or {}
    raw = body.get("raw")

    if not isinstance(raw, str) or not raw.strip():
        return jsonify({
            "success": False,
            "error": "raw が空です。GPTから出たJSONをそのまま貼り付けてください。"
        }), 400

    # JSONとしてパースできるか確認
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        return jsonify({
            "success": False,
            "error": f"JSONとして読み込めませんでした: {e}"
        }), 400

    # 既存のロジックを流用：dictを直接渡す
    try:
        app.import_state_data(parsed)
    except Exception as e:
        print(f"[エラー] import_state_data で例外: {e}")
        return jsonify({
            "success": False,
            "error": "import_state_data 実行中にエラーが発生しました。"
        }), 500

    # 取り込み後の今日のおすすめも返しておく
    recs = app.get_today_recommendation()
    return jsonify({
        "success": True,
        "data": recs
    })



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
    
    print("=" * 50)
    print(f"千紗 Web版を起動します")
    print(f"URL: http://{HOST}:{PORT}")
    print(f"デバッグモード: {'ON' if DEBUG else 'OFF'}")
    print("=" * 50)
    
    server.run(debug=DEBUG, host=HOST, port=PORT)
    
    
    