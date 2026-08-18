import argparse
import json
from contextlib import closing

from .service import Store, load_config


def main():
    parser = argparse.ArgumentParser(description="Local Rymdresan highscore administration")
    parser.add_argument("--config", required=True)
    sub = parser.add_subparsers(dest="command", required=True)
    listing = sub.add_parser("list")
    listing.add_argument("--limit", type=int, default=100)
    delete = sub.add_parser("delete")
    delete.add_argument("id", type=int)
    sub.add_parser("rebuild-json")
    sub.add_parser("backup")
    sub.add_parser("integrity")
    args = parser.parse_args()
    store = Store(load_config(args.config))
    store.initialize()
    if args.command == "list":
        with closing(store.connect()) as conn:
            rows = conn.execute(
                "SELECT id,name,score,level,reached_moon,duration_ms,platform,created_at_ms FROM scores "
                "ORDER BY score DESC,level DESC,duration_ms ASC LIMIT ?", (args.limit,),
            ).fetchall()
            print(json.dumps([dict(row) for row in rows], ensure_ascii=False, indent=2))
    elif args.command == "delete":
        with closing(store.connect()) as conn:
            conn.execute("DELETE FROM scores WHERE id=?", (args.id,))
        store.publish()
    elif args.command == "rebuild-json":
        store.publish()
    elif args.command == "backup":
        print(store.backup())
    elif args.command == "integrity":
        result = store.integrity()
        print(result)
        raise SystemExit(0 if result == "ok" else 1)


if __name__ == "__main__":
    main()
