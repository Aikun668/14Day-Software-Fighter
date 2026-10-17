"""生成软著「源程序鉴别材料」（前 30 页 + 后 30 页，每页 50 行）。

用法（项目根目录）：
    backend\\.venv\\Scripts\\python.exe docs\\软著材料\\_gen_source_material.py

规则（软著登记常规要求）：
- 每页 50 行源程序，页眉含软件名称与版本、页码；
- 提交前 30 页与后 30 页（若总页数不足 60 页则全部提交）；
- 内容须为真实源代码，不得编造。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = Path(__file__).resolve().parent

SOFTWARE_NAME = "吸入治疗指导与依从性辅助管理软件"
VERSION = "V1.0"
LINES_PER_PAGE = 50

# 纳入鉴别材料的源码范围（按实际代码组织，覆盖三端）
SCAN_DIRS = [
    ("后端", ROOT / "backend" / "app"),
    ("医护端", ROOT / "frontend-web" / "src"),
    ("患者端", ROOT / "patient-app" / "src"),
    ("种子数据", ROOT / "seed"),
]
EXTS = {".py", ".ts", ".tsx"}


def collect() -> list[tuple[str, str, int]]:
    """返回 [(模块, 文件相对路径, 行号, 内容行)]，按目录顺序与文件名排序。"""
    lines: list[tuple[str, str, int]] = []
    for label, d in SCAN_DIRS:
        if not d.exists():
            continue
        files = sorted(
            (p for p in d.rglob("*") if p.suffix in EXTS and p.is_file()),
            key=lambda p: str(p).lower(),
        )
        for f in files:
            if "__pycache__" in f.parts or "node_modules" in f.parts:
                continue
            try:
                text = f.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            rel = str(f.relative_to(ROOT)).replace("\\", "/")
            for i, line in enumerate(text.splitlines(), start=1):
                lines.append((label, rel, i, line))
            # 文件之间空一行，便于阅读
            lines.append((label, rel, 0, ""))
    return lines


def paginate(lines, per_page=LINES_PER_PAGE):
    return [lines[i:i + per_page] for i in range(0, len(lines), per_page)]


def render_page(page_lines, page_no: int, total: int) -> str:
    header = (
        f"{SOFTWARE_NAME} {VERSION}"
        f"{' ' * 20}第 {page_no} 页 / 共 {total} 页"
    )
    body = []
    for label, rel, lineno, content in page_lines:
        if lineno == 0:
            body.append("")
        else:
            body.append(f"{content}")
    return header + "\n" + "\n".join(body)


def main() -> None:
    all_lines = collect()
    pages = paginate(all_lines)
    total = len(pages)
    print(f"源码行数：{len(all_lines)}  总页数：{total}")

    if total >= 60:
        selected = list(range(0, 30)) + list(range(total - 30, total))
        scope = "前 30 页 + 后 30 页"
    else:
        selected = list(range(total))
        scope = f"全部 {total} 页（不足 60 页）"

    out = OUT_DIR / f"源程序鉴别材料_{VERSION}.txt"
    with out.open("w", encoding="utf-8") as fh:
        fh.write(f"{SOFTWARE_NAME} {VERSION} — 源程序鉴别材料\n")
        fh.write(f"提交范围：{scope}（每页 {LINES_PER_PAGE} 行）\n")
        fh.write("=" * 78 + "\n\n")
        for idx, page_index in enumerate(selected, start=1):
            fh.write(render_page(pages[page_index], idx, len(selected)))
            fh.write("\n\n" + "-" * 78 + "\n\n")

    size_kb = out.stat().st_size / 1024
    print(f"已生成：{out}")
    print(f"提交页数：{len(selected)}  文件大小：{size_kb:.1f} KB")


if __name__ == "__main__":
    main()
